"""
BirdSong Observatory - Generic Custom TFLite Adapter
====================================================
Runs custom-trained TFLite acoustic models configured via manifest.json.
Supports arbitrary target sample rates, Mel spectrogram inputs, and activations.
"""

import numpy as np
from typing import List, Tuple, Dict, Any
from .base import ModelAdapter

class GenericTFLiteAdapter(ModelAdapter):
    def __init__(self, model_id: str, threshold: float = 0.5):
        super().__init__(model_id, threshold)
        self.interpreter = None
        self.input_details = None
        self.output_details = None

    def load(self, model_path: str, labels_path: str, manifest: Dict[str, Any]):
        self.manifest = manifest or {}
        self.target_sample_rate = int(self.manifest.get("target_sample_rate", 32000))
        self.input_type = self.manifest.get("input_type", "mel_spectrogram")
        self.labels = self.parse_labels(labels_path)

        try:
            from ai_edge_litert.interpreter import Interpreter
        except ImportError:
            try:
                from tflite_runtime.interpreter import Interpreter
            except ImportError:
                try:
                    from tensorflow.lite.python.interpreter import Interpreter
                except ImportError:
                    raise ImportError("Please install 'tflite-runtime', 'ai-edge-litert', or 'tensorflow' for custom TFLite models.")

        self.interpreter = Interpreter(model_path=model_path, num_threads=4)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.is_loaded = True

    def predict(self, audio_48k: np.ndarray) -> List[Tuple[str, float]]:
        if not self.is_loaded or self.interpreter is None:
            return []

        # 1. Resample to target sample rate
        resampled_audio = self.resample_audio(audio_48k, self.target_sample_rate)

        # 2. Format input tensor based on manifest
        if self.input_type == "mel_spectrogram":
            n_mels = int(self.manifest.get("n_mels", 128))
            n_fft = int(self.manifest.get("n_fft", 1024))
            hop = int(self.manifest.get("hop_length", 320))
            mel = self.compute_mel_spectrogram(resampled_audio, self.target_sample_rate, n_mels, n_fft, hop)
            
            # Match model input shape (e.g. [1, 128, N, 1] or [1, 128, N])
            expected_shape = self.input_details[0]['shape']
            if len(expected_shape) == 4:
                input_tensor = np.expand_dims(np.expand_dims(mel, axis=0), axis=-1)
            else:
                input_tensor = np.expand_dims(mel, axis=0)
        else:
            # 1D Raw waveform
            input_tensor = np.expand_dims(resampled_audio, axis=0)

        # Set tensor & invoke
        self.interpreter.set_tensor(self.input_details[0]['index'], input_tensor.astype(np.float32))
        self.interpreter.invoke()

        raw_output = self.interpreter.get_tensor(self.output_details[0]['index'])[0]

        # Output activation
        activation = self.manifest.get("output_activation", "sigmoid").lower()
        if activation == "sigmoid":
            probabilities = 1.0 / (1.0 + np.exp(-raw_output))
        elif activation == "softmax":
            exp_vals = np.exp(raw_output - np.max(raw_output))
            probabilities = exp_vals / np.sum(exp_vals)
        else:
            probabilities = raw_output

        results: List[Tuple[str, float]] = []
        indices = np.where(probabilities >= self.threshold)[0]

        for idx in indices:
            conf = float(probabilities[idx])
            if idx < len(self.labels):
                results.append((self.labels[idx].strip(), round(conf, 4)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results
