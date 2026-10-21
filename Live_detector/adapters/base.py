"""
BirdSong Observatory - Base Model Adapter Interface
===================================================
All acoustic inference engines (BirdNET, custom TFLite, ONNX) inherit from ModelAdapter.
Handles dynamic audio resampling, feature extraction (Mel spectrograms),
and threshold filtering based on the model's manifest.json.
"""

from abc import ABC, abstractmethod
import numpy as np
from scipy import signal
from typing import List, Tuple, Dict, Any, Optional

class ModelAdapter(ABC):
    def __init__(self, model_id: str, threshold: float = 0.5):
        self.model_id = model_id
        self.threshold = threshold
        self.labels: List[str] = []
        self.manifest: Dict[str, Any] = {}
        self.target_sample_rate: int = 48000
        self.input_type: str = "raw_waveform"  # or "mel_spectrogram"
        self.is_loaded: bool = False

    @abstractmethod
    def load(self, model_path: str, labels_path: str, manifest: Dict[str, Any]):
        """Loads weights, label files, and manifest configurations."""
        pass

    @abstractmethod
    def predict(self, audio_48k: np.ndarray) -> List[Tuple[str, float]]:
        """
        Runs model inference on the provided 3-second 48kHz audio array.
        Returns: List of (label_or_common_name, confidence_score) meeting self.threshold.
        """
        pass

    def resample_audio(self, audio_48k: np.ndarray, target_sr: int) -> np.ndarray:
        """High-efficiency rational polyphase resampling to model target sample rate."""
        if target_sr == 48000:
            return audio_48k
        from math import gcd
        g = gcd(48000, target_sr)
        up = target_sr // g
        down = 48000 // g
        return signal.resample_poly(audio_48k, up, down).astype(np.float32)

    def compute_mel_spectrogram(
        self,
        audio: np.ndarray,
        sr: int,
        n_mels: int = 128,
        n_fft: int = 1024,
        hop_length: int = 320
    ) -> np.ndarray:
        """
        Extracts Log-Mel Spectrogram matrix compatible with PyTorch/TensorFlow CNN inputs.
        """
        # Linear STFT spectrogram
        f, t, Sxx = signal.spectrogram(
            audio,
            fs=sr,
            window='hann',
            nperseg=n_fft,
            noverlap=n_fft - hop_length,
            mode='magnitude'
        )
        
        # Approximate triangular Mel filterbank
        f_min = 50.0
        f_max = sr / 2.0
        mel_min = 2595.0 * np.log10(1.0 + f_min / 700.0)
        mel_max = 2595.0 * np.log10(1.0 + f_max / 700.0)
        mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
        hz_points = 700.0 * (10.0 ** (mel_points / 2595.0) - 1.0)
        
        bins = np.floor((n_fft + 1) * hz_points / sr).astype(int)
        filterbank = np.zeros((n_mels, Sxx.shape[0]), dtype=np.float32)
        
        for m in range(1, n_mels + 1):
            f_m_minus = bins[m - 1]
            f_m = bins[m]
            f_m_plus = bins[m + 1]
            
            for k in range(f_m_minus, f_m):
                if f_m != f_m_minus and k < Sxx.shape[0]:
                    filterbank[m - 1, k] = (k - bins[m - 1]) / (bins[m] - bins[m - 1])
            for k in range(f_m, f_m_plus):
                if f_m_plus != f_m and k < Sxx.shape[0]:
                    filterbank[m - 1, k] = (bins[m + 1] - k) / (bins[m + 1] - bins[m])

        mel_spec = np.dot(filterbank, Sxx)
        # Log compression (in dB)
        log_mel = 20.0 * np.log10(np.maximum(mel_spec, 1e-5))
        return log_mel.astype(np.float32)

    def parse_labels(self, labels_path: str) -> List[str]:
        """Parses label text file line by line."""
        labels = []
        with open(labels_path, "r", encoding="utf-8") as f:
            for line in f:
                l = line.strip()
                if l:
                    labels.append(l)
        return labels
