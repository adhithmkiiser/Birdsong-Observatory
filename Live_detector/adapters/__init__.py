"""
Model Adapters Package
"""
from .base import ModelAdapter
from .birdnet_tflite import BirdNetTFLiteAdapter
from .generic_tflite import GenericTFLiteAdapter
from .onnx_adapter import ONNXModelAdapter

__all__ = [
    "ModelAdapter",
    "BirdNetTFLiteAdapter",
    "GenericTFLiteAdapter",
    "ONNXModelAdapter"
]
