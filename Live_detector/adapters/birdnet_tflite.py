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

class BirdNetTFLiteAdapter(ModelAdapter):
    def __init__(self, model_id: str = "birdnet_default", threshold: float = 0.5):
        super().__init__(model_id, threshold)
        self.interpreter = None
        self.input_details = None
        self.output_details = None

    def load(self, model_path: str, labels_path: str, manifest: Dict[str, Any] = None):
        self.manifest = manifest or {}
        self.target_sample_rate = 48000
        self.labels = self.parse_labels(labels_path)

        # Import TFLite interpreter (supports lightweight tflite-runtime or full tensorflow)
        try:
            from tflite_runtime.interpreter import Interpreter
        except ImportError:
            try:
                from tensorflow.lite.python.interpreter import Interpreter
            except ImportError:
                raise ImportError("Please install 'tflite-runtime' or 'tensorflow' to use BirdNET TFLite models.")

        self.interpreter = Interpreter(model_path=model_path, num_threads=4)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.is_loaded = True

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

        results: List[Tuple[str, float]] = []
        indices = np.where(probabilities >= self.threshold)[0]

        for idx in indices:
            conf = float(probabilities[idx])
            if idx < len(self.labels):
                label_str = self.labels[idx]
                # BirdNET format is often "Scientific_name_Common Name"
                parts = label_str.split("_")
                common_name = parts[-1].strip() if len(parts) > 1 else label_str.strip()
                results.append((common_name, round(conf, 4)))

        # Sort descending by confidence
        results.sort(key=lambda x: x[1], reverse=True)
        return results
