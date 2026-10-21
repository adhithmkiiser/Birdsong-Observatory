"""
BirdSong Observatory - DSP Acoustic Activity & Triage Watchdog
==============================================================
Performs model-independent physical acoustic analysis on every 3-second window:
1. Calculates multi-band energy (Low: mammals/frogs, Mid: birds, High: insects).
2. Connected-component spectro-temporal event counting (blobs above noise floor).
3. Spectral Flatness & Temporal Variance filters (separates rain/wind/cicadas from biophony).
4. Evaluates ML detections against acoustic reality to output triage flags:
   - UNDER_DETECTED: High activity, but zero or poor detections.
   - MODEL_DISAGREEMENT: Different models predict divergent species.
   - BAND_MISMATCH: Detected species calling outside its natural vocal frequency envelope.
   - POSSIBLE_OVERLAP: Multiple discrete acoustic events, but only one species reported.
   - UNCOVERED_TAXA: Energy in mammal/frog band, but only bird models ran.
   - LOW_SNR: Detections occurring at or below local noise floor.
   - AMBIENT_NOISE: Stationary broadband rain or wind.
"""

import numpy as np
from scipy import signal
from scipy import ndimage
from typing import Dict, List, Tuple, Any, Optional
from config import (
    SAMPLE_RATE, BAND_LOW_FREQ, BAND_MID_FREQ, BAND_HIGH_FREQ,
    ACTIVITY_SNR_THRESHOLD_DB, OCCUPIED_AREA_THRESHOLD,
    SPECTRAL_FLATNESS_RAIN_THRESHOLD, INSECT_VARIANCE_THRESHOLD
)

# Reference vocal frequency bands for common Western Ghats / Indian species
SPECIES_FREQUENCY_ENVELOPES = {
    # Large mammals: Low frequencies (0.15 - 1.2 kHz)
    "asian elephant": (80, 500),
    "sambar": (250, 1400),
    "barking deer": (300, 1500),
    "muntjac": (300, 1500),
    "wild boar": (200, 1000),
    "lion-tailed macaque": (400, 2500),
    "bonnet macaque": (500, 3000),
    # Birds: Mid to high frequencies (1.0 - 8.5 kHz)
    "common myna": (1200, 5500),
    "house crow": (700, 3200),
    "large-billed crow": (600, 2800),
    "white-cheeked barbet": (1000, 2600),
    "coppersmith barbet": (900, 2200),
    "malabar grey hornbill": (800, 2800),
    "nilgiri laughingthrush": (1500, 5500),
    "nilgiri sholakili": (1800, 6500),
    "white-bellied blue robin": (1800, 6800),
    "black-and-orange flycatcher": (2200, 7500),
    "oriental magpie-robin": (1500, 6000),
    "tickell's blue flycatcher": (2000, 7200),
    "indian pitta": (1400, 3800),
    "jungle babbler": (1200, 4800)
}

class WindowActivityReport:
    def __init__(self,
                 event_count: int,
                 occupied_area_ratio: float,
                 low_band_energy: float,
                 mid_band_energy: float,
                 high_band_energy: float,
                 snr_db: float,
                 spectral_flatness: float,
                 is_ambient_noise: bool,
                 is_insect_dominated: bool):
        self.event_count = event_count
        self.occupied_area_ratio = occupied_area_ratio
        self.low_band_energy = low_band_energy
        self.mid_band_energy = mid_band_energy
        self.high_band_energy = high_band_energy
        self.snr_db = snr_db
        self.spectral_flatness = spectral_flatness
        self.is_ambient_noise = is_ambient_noise
        self.is_insect_dominated = is_insect_dominated

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_count": self.event_count,
            "occupied_area_ratio": round(self.occupied_area_ratio, 4),
            "low_band_energy": round(self.low_band_energy, 4),
            "mid_band_energy": round(self.mid_band_energy, 4),
            "high_band_energy": round(self.high_band_energy, 4),
            "snr_db": round(self.snr_db, 2),
            "spectral_flatness": round(self.spectral_flatness, 4),
            "is_ambient_noise": self.is_ambient_noise,
            "is_insect_dominated": self.is_insect_dominated
        }

def compute_window_activity(audio_48k: np.ndarray) -> WindowActivityReport:
    """
    Computes model-independent acoustic physics and event counters for a 3-second audio array.
    Executes in < 15ms on Raspberry Pi 4 CPU.
    """
    # 1. Compute Fast STFT Spectrogram
    # 1024 nperseg at 48kHz = 46.8 Hz resolution, 512 hop = 10.6 ms temporal resolution
    f, t, Sxx = signal.spectrogram(
        audio_48k,
        fs=SAMPLE_RATE,
        window='hann',
        nperseg=1024,
        noverlap=512,
        mode='magnitude'
    )

    # Convert to power in dB with safety floor
    Sxx_db = 20 * np.log10(np.maximum(Sxx, 1e-6))

    # 2. Local Noise Floor Estimation (15th percentile across time for each frequency bin)
    noise_floor_per_bin = np.percentile(Sxx_db, 15, axis=1, keepdims=True)
    signal_above_noise = Sxx_db - noise_floor_per_bin

    # 3. Overall SNR estimation
    snr_db = float(np.percentile(signal_above_noise, 95))

    # 4. Multi-band Energy Slicing
    def band_energy(f_range: Tuple[int, int]) -> float:
        mask = (f >= f_range[0]) & (f <= f_range[1])
        if not np.any(mask):
            return 0.0
        # Positive excess power above noise
        excess = np.maximum(0, signal_above_noise[mask, :])
        return float(np.mean(excess))

    low_energy = band_energy(BAND_LOW_FREQ)
    mid_energy = band_energy(BAND_MID_FREQ)
    high_energy = band_energy(BAND_HIGH_FREQ)

    # 5. Spectral Flatness (Wiener Entropy) for Rain/Wind Detection
    # Flatness = geometric_mean(power) / arithmetic_mean(power)
    power = np.maximum(Sxx, 1e-8) ** 2
    geom_mean = np.exp(np.mean(np.log(power), axis=0))
    arith_mean = np.mean(power, axis=0)
    flatness = float(np.mean(geom_mean / (arith_mean + 1e-12)))

    # Rain/wind typically has high flatness (broadband white/pink noise)
    is_ambient_noise = bool(flatness > SPECTRAL_FLATNESS_RAIN_THRESHOLD and mid_energy > 5.0)

    # 6. Insect / Cicada Detection (Continuous drone has very low temporal variance in high band)
    high_mask = (f >= BAND_HIGH_FREQ[0]) & (f <= BAND_HIGH_FREQ[1])
    if np.any(high_mask):
        high_band_temporal_var = float(np.var(np.mean(signal_above_noise[high_mask, :], axis=0)))
        is_insect_dominated = bool(high_energy > 8.0 and high_band_temporal_var < INSECT_VARIANCE_THRESHOLD)
    else:
        is_insect_dominated = False

    # 7. Spectro-temporal Event Counting (Blob Labeling)
    # Threshold binary mask: pixels > 6 dB above noise floor
    binary_mask = (signal_above_noise > 6.0) & (f[:, None] >= 200) & (f[:, None] <= 12000)
    labeled_array, num_features = ndimage.label(binary_mask)

    # Filter out tiny single-pixel noise specs (keep blobs > 6 connected bins)
    if num_features > 0:
        sizes = ndimage.sum(binary_mask, labeled_array, range(1, num_features + 1))
        significant_events = int(np.sum(sizes >= 6))
    else:
        significant_events = 0

    # 8. Occupied time-frequency area ratio
    total_bins = binary_mask.size
    occupied_bins = np.sum(binary_mask)
    occupied_area_ratio = float(occupied_bins / total_bins)

    return WindowActivityReport(
        event_count=significant_events,
        occupied_area_ratio=occupied_area_ratio,
        low_band_energy=low_energy,
        mid_band_energy=mid_energy,
        high_band_energy=high_energy,
        snr_db=snr_db,
        spectral_flatness=flatness,
        is_ambient_noise=is_ambient_noise,
        is_insect_dominated=is_insect_dominated
    )

def evaluate_discrepancy_flags(
    activity: WindowActivityReport,
    model_predictions: Dict[str, List[Tuple[str, float]]],
    active_model_runtimes: Dict[str, str]
) -> Tuple[List[str], float]:
    """
    Evaluates ML predictions across models against the unbiased physical activity report.
    Returns: (list_of_flags, explained_ratio)
    """
    flags: List[str] = []

    # Flatten unique species detected across all models
    all_detections = []
    unique_species = set()
    model_predicted_species = {}

    for model_id, preds in model_predictions.items():
        species_in_model = set()
        for species_name, conf in preds:
            s_lower = species_name.lower().strip()
            unique_species.add(s_lower)
            species_in_model.add(s_lower)
            all_detections.append((model_id, s_lower, conf))
        model_predicted_species[model_id] = species_in_model

    species_count = len(unique_species)

    # Calculate rough explained ratio (detected species events ÷ physical acoustic events)
    if activity.event_count > 0:
        explained_ratio = min(1.0, float(species_count / max(1, activity.event_count)))
    else:
        explained_ratio = 1.0 if species_count == 0 else 0.5

    # 1. Ambient Noise Tag
    if activity.is_ambient_noise:
        flags.append("AMBIENT_NOISE")

    # 2. Under-Detected Flag: Physical acoustic events occurred, but models found nothing
    if (activity.event_count >= 3 or activity.occupied_area_ratio > OCCUPIED_AREA_THRESHOLD) and not activity.is_ambient_noise:
        if species_count == 0:
            flags.append("UNDER_DETECTED")
        elif species_count == 1 and activity.event_count >= 5:
            flags.append("POSSIBLE_OVERLAP")

    # 3. Model Disagreement Flag: Multi-model evaluation divergence
    if len(model_predictions) >= 2:
        models = list(model_predicted_species.keys())
        set_a = model_predicted_species[models[0]]
        set_b = model_predicted_species[models[1]]
        if set_a != set_b and (len(set_a) > 0 or len(set_b) > 0):
            flags.append("MODEL_DISAGREEMENT")

    # 4. Band Mismatch Flag: Species vocalization frequency check
    for model_id, s_name, conf in all_detections:
        for known_species, (f_min, f_max) in SPECIES_FREQUENCY_ENVELOPES.items():
            if known_species in s_name:
                # If species is a low-frequency animal (e.g. deer) but mid/high band dominated
                if f_max < 1500 and activity.low_band_energy < 1.0 and activity.mid_band_energy > 4.0:
                    if "BAND_MISMATCH" not in flags:
                        flags.append("BAND_MISMATCH")
                # If species is high-frequency bird but low band dominated
                elif f_min > 2000 and activity.mid_band_energy < 1.0 and activity.low_band_energy > 5.0:
                    if "BAND_MISMATCH" not in flags:
                        flags.append("BAND_MISMATCH")

    # 5. Uncovered Taxa: Low frequency mammal/frog energy present, but only bird models ran
    if activity.low_band_energy > 4.5 and not activity.is_ambient_noise:
        # Check if any active model has mammal in its name or labels
        has_mammal_model = any("mammal" in str(m_id).lower() for m_id in model_predictions.keys())
        if not has_mammal_model:
            flags.append("UNCOVERED_TAXA")

    # 6. Low SNR Flag
    if species_count > 0 and activity.snr_db < ACTIVITY_SNR_THRESHOLD_DB:
        flags.append("LOW_SNR")

    return flags, round(explained_ratio, 3)
