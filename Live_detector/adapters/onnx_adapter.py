"""
BirdSong Observatory - High-Performance ONNX Model Adapter
==========================================================
Recommended engine for custom PyTorch/TensorFlow models deployed to Raspberry Pi.
Runs via onnxruntime with ARM NEON / multithreaded CPU optimization.
Zero PyTorch/TensorFlow framework overhead on field hardware.
"""

import numpy as np
from typing import List, Tuple, Dict, Any
from .base import ModelAdapter

class ONNXModelAdapter(ModelAdapter):
    def __init__(self, model_id: str, threshold: float = 0.5):
        super().__init__(model_id, threshold)
        self.session = None
        self.input_name = None
        self.output_name = None

    def load(self, model_path: str, labels_path: str, manifest: Dict[str, Any]):
        self.manifest = manifest or {}
        self.target_sample_rate = int(self.manifest.get("target_sample_rate", 32000))
        self.input_type = self.manifest.get("input_type", "mel_spectrogram")
        self.labels = self.parse_labels(labels_path)

        try:
            import onnxruntime as ort
        except ImportError:
            raise ImportError("Please install 'onnxruntime' via 'pip install onnxruntime' to run ONNX models.")

        # Optimize runtime options for multi-core ARM Raspberry Pi
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 4
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(model_path, sess_options=opts, providers=['CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.is_loaded = True

    def predict(self, audio_48k: np.ndarray) -> List[Tuple[str, float]]:
        if not self.is_loaded or self.session is None:
            return []

        # 1. Resample to model's expected sample rate
        resampled_audio = self.resample_audio(audio_48k, self.target_sample_rate)

        # 2. Extract features or pass raw waveform
        if self.input_type == "mel_spectrogram":
            n_mels = int(self.manifest.get("n_mels", 128))
            n_fft = int(self.manifest.get("n_fft", 1024))
            hop = int(self.manifest.get("hop_length", 320))
            mel = self.compute_mel_spectrogram(resampled_audio, self.target_sample_rate, n_mels, n_fft, hop)
            
            # Format shape: [batch, channels, n_mels, time] or [batch, n_mels, time]
            expected_shape = self.session.get_inputs()[0].shape
            if len(expected_shape) == 4:
                input_tensor = np.expand_dims(np.expand_dims(mel, axis=0), axis=1) # [1, 1, 128, N]
            else:
                input_tensor = np.expand_dims(mel, axis=0) # [1, 128, N]
        else:
            # 1D Raw waveform [batch, length]
            input_tensor = np.expand_dims(resampled_audio, axis=0)

        # 3. ONNX Runtime inference execution
        raw_outputs = self.session.run([self.output_name], {self.input_name: input_tensor.astype(np.float32)})
        raw_output = raw_outputs[0][0]

        # 4. Activation function (Sigmoid or Softmax)
        activation = self.manifest.get("output_activation", "sigmoid").lower()
        if activation == "sigmoid":
            probabilities = 1.0 / (1.0 + np.exp(-np.clip(raw_output, -20.0, 20.0)))
        elif activation == "softmax":
            exp_vals = np.exp(raw_output - np.max(raw_output))
            probabilities = exp_vals / np.sum(exp_vals)
        else:
            probabilities = raw_output

        # 5. Extract confident predictions
        results: List[Tuple[str, float]] = []
        indices = np.where(probabilities >= self.threshold)[0]

        for idx in indices:
            conf = float(probabilities[idx])
            if idx < len(self.labels):
                results.append((self.labels[idx].strip(), round(conf, 4)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results
