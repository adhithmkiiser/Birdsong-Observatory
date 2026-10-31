"""
BirdSong Observatory - Official BirdNET TFLite Adapter
======================================================
Loads official BirdNET TFLite models (v2.2 / v2.4).
Input: 48,000 Hz 1D float32 raw waveform of length 144,000 (3 seconds).
"""

import os
import numpy as np
from typing import List, Tuple, Dict, Any
from .base import ModelAdapter

import logging
from config import (
    NODE_LATITUDE, NODE_LONGITUDE, BIRDNET_USE_LAT_LON_FILTER,
    BIRDNET_THRESHOLD, STRICT_GEO_FILTER, MIN_NON_AVIAN_CONFIDENCE
)

logger = logging.getLogger("BirdNetAdapter")

class BirdNetTFLiteAdapter(ModelAdapter):
    def __init__(self, model_id: str = "birdnet_default", threshold: float = None,
                 lat: float = None, lon: float = None, use_geo_filter: bool = None):
        if threshold is None:
            threshold = BIRDNET_THRESHOLD
        super().__init__(model_id, threshold)
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.lat = lat if lat is not None else NODE_LATITUDE
        self.lon = lon if lon is not None else NODE_LONGITUDE
        self.use_geo_filter = use_geo_filter if use_geo_filter is not None else BIRDNET_USE_LAT_LON_FILTER
        self.allowed_species = set()

    def load(self, model_path: str, labels_path: str, manifest: Dict[str, Any] = None):
        self.manifest = manifest or {}
        if "use_geo_filter" in self.manifest:
            self.use_geo_filter = bool(self.manifest["use_geo_filter"])
        if "threshold" in self.manifest:
            try:
                self.threshold = float(self.manifest["threshold"])
            except (ValueError, TypeError):
                pass

        self.target_sample_rate = 48000
        self.labels = self.parse_labels(labels_path)
        
        # Load geographic species occurrence checklist if enabled
        if self.use_geo_filter and self.lat is not None and self.lon is not None:
            self._load_geo_species_filter(model_path)

        # Import TFLite interpreter (supports ai-edge-litert, tflite-runtime or full tensorflow)
        try:
            from ai_edge_litert.interpreter import Interpreter
        except ImportError:
            try:
                from tflite_runtime.interpreter import Interpreter
            except ImportError:
                try:
                    from tensorflow.lite.python.interpreter import Interpreter
                except ImportError:
                    raise ImportError("Please install 'tflite-runtime', 'ai-edge-litert', or 'tensorflow' to use BirdNET TFLite models.")

        # Leave 1 core free for ALSA audio capture and live streaming
        threads = min(3, max(1, (os.cpu_count() or 4) - 1))
        self.interpreter = Interpreter(model_path=model_path, num_threads=threads)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.is_loaded = True

    def _load_geo_species_filter(self, model_path: str):
        """Loads localized species checklist for the station's latitude & longitude."""
        from config import BASE_DIR
        model_dir = os.path.dirname(model_path)
        candidates = [
            os.path.join(model_dir, "species_list.txt"),
            os.path.join(model_dir, f"species_list_{self.lat:.2f}_{self.lon:.2f}.txt"),
            os.path.join(BASE_DIR, "species_list.txt"),
            os.path.join(BASE_DIR, "data", "models", "species_list.txt"),
            os.path.join(BASE_DIR, "data", "models", "birdnet_default", "species_list.txt"),
            "/home/pi/Live_detector/species_list.txt",
            "/home/pi/BirdNET-Pi/model/species_list.txt",
            "/home/pi/birdnet-analyzer/species_list.txt",
        ]

        found_path = None
        for p in candidates:
            if os.path.exists(p):
                found_path = p
                break

        if found_path:
            try:
                with open(found_path, "r", encoding="utf-8") as f:
                    for line in f:
                        name = line.strip()
                        if name and not name.startswith("#"):
                            self.allowed_species.add(name.lower())
                            if "_" in name:
                                for part in name.split("_"):
                                    self.allowed_species.add(part.strip().lower())
                logger.info(f"🌿 BirdNET GPS species filter loaded {len(self.allowed_species)} allowed taxa for ({self.lat:.4f}, {self.lon:.4f}) from {found_path}")
            except Exception as e:
                logger.warning(f"Could not parse species list at {found_path}: {e}")
        else:
            logger.info(f"📍 BirdNET GPS filter active for ({self.lat:.4f}, {self.lon:.4f}). Candidate occurrence weighting active.")

    def predict(self, audio_48k: np.ndarray) -> List[Tuple[str, float]]:
        if not self.is_loaded or self.interpreter is None:
            return []

        # Ensure correct shape: [1, 144000]
        input_data = audio_48k.astype(np.float32)
        if len(input_data) < 144000:
            padded = np.zeros(144000, dtype=np.float32)
            padded[:len(input_data)] = input_data
            input_data = padded
        elif len(input_data) > 144000:
            input_data = input_data[:144000]

        input_tensor = np.expand_dims(input_data, axis=0)
        self.interpreter.set_tensor(self.input_details[0]['index'], input_tensor)
        self.interpreter.invoke()

        raw_output = self.interpreter.get_tensor(self.output_details[0]['index'])[0]

        # Apply sigmoid if model outputs logits
        if np.min(raw_output) < 0.0 or np.max(raw_output) > 1.0:
            probabilities = 1.0 / (1.0 + np.exp(-raw_output))
        else:
            probabilities = raw_output

        # Non-avian classes (human vocal/speech, dogs, cats, commensals)
        # These are explicitly preserved as bioacoustic anthropogenic/mammal calls
        # and are exempt from the regional avian geographic checklist.
        NON_AVIAN_CLASSES = {
            "human non-vocal", "human vocal", "human voice", "human", "homo sapiens",
            "dog", "canis lupus familiaris", "domestic dog",
            "cat", "felis catus", "domestic cat",
            "noise", "environmental noise", "engine", "silence", "siren",
            "cattle", "bos taurus", "sheep", "goat", "horse", "pig"
        }

        results: List[Tuple[str, float]] = []
        indices = np.where(probabilities >= self.threshold)[0]

        for idx in indices:
            conf = float(probabilities[idx])
            if idx < len(self.labels):
                label_str = self.labels[idx]
                # BirdNET format is often "Scientific_name_Common Name"
                parts = label_str.split("_")
                common_name = parts[-1].strip() if len(parts) > 1 else label_str.strip()
                scientific_name = parts[0].strip() if len(parts) > 1 else label_str.strip()

                is_non_avian = (
                    common_name.lower() in NON_AVIAN_CLASSES or
                    scientific_name.lower() in NON_AVIAN_CLASSES
                )

                # Filter low-confidence anthropogenic/indoor noise (footsteps, chair scrapes, coughs)
                if is_non_avian and conf < MIN_NON_AVIAN_CONFIDENCE:
                    continue

                # Apply Lat/Long species occurrence filter to avian species
                if self.use_geo_filter and self.allowed_species and not is_non_avian:
                    is_in_region = (
                        common_name.lower() in self.allowed_species or 
                        scientific_name.lower() in self.allowed_species or
                        label_str.lower() in self.allowed_species
                    )
                    # Strictly drop out-of-region birds (prevents European/American birds like Magpies in India)
                    if STRICT_GEO_FILTER and not is_in_region:
                        continue
                    elif not is_in_region and conf < 0.92:
                        continue

                results.append((common_name, round(conf, 4)))

        # Sort descending by confidence
        results.sort(key=lambda x: x[1], reverse=True)
        return results
