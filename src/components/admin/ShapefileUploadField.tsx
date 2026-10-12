'use client';

import React, { useState, useRef } from 'react';
import { Layers, Upload, CheckCircle2, AlertCircle, Trash2, FileCheck, Loader2 } from 'lucide-react';
import { parseShapefileOrGeoJson, ParsedShapefileResult } from '@/lib/shapefileParser';

interface ShapefileUploadFieldProps {
  label?: string;
  shapefile: ParsedShapefileResult | null;
  onShapefileChange: (result: ParsedShapefileResult | null) => void;
  onCentroidExtracted?: (lat: number, lng: number) => void;
  targetHabitat?: 'LC' | 'LI' | 'CS' | 'common' | 'live';
}

export function ShapefileUploadField({
  label = 'Shapefile / Boundary Polygon (Optional)',
  shapefile,
  onShapefileChange,
  onCentroidExtracted,
  targetHabitat
}: ShapefileUploadFieldProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setIsProcessing(true);

    try {
      const result = await parseShapefileOrGeoJson(file);
      onShapefileChange(result);
      if (result.centroid && onCentroidExtracted) {
        onCentroidExtracted(result.centroid[0], result.centroid[1]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process file');
      onShapefileChange(null);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShapefileChange(null);
    setErrorMsg('');
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5 text-xs transition-all">
      <div className="flex items-center justify-between">
        <label className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>{label}</span>
        </label>
        {shapefile && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.kmz,.kml,.shp,.geojson,.json"
        onChange={handleFile}
        className="hidden"
        id={`shapefile-input-${Math.random().toString(36).substring(2, 9)}`}
      />

      {!shapefile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition text-center group"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2 text-emerald-700 py-1 font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Parsing shapefile geometry...</span>
            </div>
          ) : (
            <>
              <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center transition">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] font-bold text-slate-700">
                Click to upload <span className="text-emerald-700 font-black">.kml</span>, <span className="text-emerald-700 font-black">.kmz</span>, <span className="text-emerald-700 font-black">.zip (Shapefile)</span>, <span className="text-emerald-700 font-black">.shp</span>, or <span className="text-emerald-700 font-black">.geojson</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Supports Google Earth (KML/KMZ), ESRI Shapefiles (.zip/.shp), and GeoJSON boundaries
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-1.5 text-emerald-900">
          <div className="flex items-center justify-between font-bold text-[11px]">
            <span className="flex items-center gap-1.5 truncate max-w-[200px]">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{shapefile.fileName}</span>
            </span>
            <span className="bg-emerald-200/80 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-mono uppercase">
              {shapefile.featureCount} {shapefile.featureCount === 1 ? 'Polygon' : 'Polygons'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-emerald-700 pt-1 border-t border-emerald-200/60 font-medium">
            <span>
              {shapefile.centroid ? (
                <>Centroid: {shapefile.centroid[0]}°N, {shapefile.centroid[1]}°E</>
              ) : (
                <>Geometric boundary loaded</>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{
                  backgroundColor:
                    targetHabitat === 'LI'
                      ? 'rgba(239, 68, 68, 0.7)'
                      : targetHabitat === 'CS'
                      ? 'rgba(245, 158, 11, 0.7)'
                      : 'rgba(16, 185, 129, 0.7)'
                }}
              />
              <span className="text-[9px] font-bold">
                {targetHabitat === 'LI'
                  ? 'Transparent Red (Infested)'
                  : targetHabitat === 'CS'
                  ? 'Transparent Amber (Control)'
                  : 'Transparent Green (Cleared/PAM)'}
              </span>
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] flex items-center gap-1.5 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
