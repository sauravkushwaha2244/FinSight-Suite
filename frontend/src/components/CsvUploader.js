'use client';

import { useState, useRef } from 'react';
import { api } from '../lib/api';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Download,
  RefreshCw, Sparkles, Database, Layers
} from 'lucide-react';

export default function CsvUploader({ onUploadSuccess, onTriggerAnalysis }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.csv')) {
        setError('Please select a valid .csv file.');
        setFile(null);
        return;
      }
      setFile(selected);
      setError('');
      setResult(null);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const blob = await api.download('/data/sample-csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finsight_sample_financial_data.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Could not download sample CSV: ' + err.message);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload('/data/upload-csv', formData);
      setResult(res);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onUploadSuccess) onUploadSuccess(res);
    } catch (err) {
      setError(err.message || 'CSV upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card p-6 border-slate-200/80 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="badge-accent flex items-center gap-1.5 text-xs font-semibold">
              <Upload className="w-3.5 h-3.5" /> Financial Data Ingestion
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Upload Financial Data
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Format: <code className="text-primary-700 bg-primary-50 px-1 py-0.5 rounded font-mono">date,category,amount,roi</code>. Ingests records, computes metrics, and retrains XGBoost.
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="btn-outline text-xs py-2 px-3 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" /> Download Sample CSV
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload area */}
      <div className="mt-5">
        <div className="border-2 border-dashed border-slate-200 hover:border-primary-400 bg-slate-50/60 hover:bg-primary-50/20 rounded-2xl p-6 text-center transition-all">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            id="csv-file-input"
          />

          <label
            htmlFor="csv-file-input"
            className="cursor-pointer flex flex-col items-center justify-center gap-2"
          >
            <div className="w-12 h-12 rounded-xl bg-primary-100/70 text-primary-600 flex items-center justify-center shadow-inner">
              <FileText className="w-6 h-6" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Choose a CSV file or drag and drop here'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV with date, category, amount, roi'}
              </p>
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Pipeline: Upload → Validate → Database → Metrics → ML Retrain → Dashboard
          </p>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary text-xs py-2.5 px-5 shadow-md ml-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
            {uploading ? 'Processing Data & Retraining ML...' : 'Upload & Train Model'}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {result && (
        <div className="mt-5 p-4 rounded-xl bg-success-50 border border-success-200 text-success-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm text-success-900">
                Data Ingested & XGBoost Model Retrained Successfully!
              </p>
              <p className="text-xs text-success-700 mt-1">
                Ingested <strong>{result.rows_ingested}</strong> rows across{' '}
                <strong>{result.categories_updated?.length || 0}</strong> categories.
                {result.model_metrics?.r2 && (
                  <span> • Model R²: <strong>{(Number(result.model_metrics.r2) * 100).toFixed(1)}%</strong> (MAE: ₹{Number(result.model_metrics.mae).toFixed(0)})</span>
                )}
              </p>

              {onTriggerAnalysis && (
                <div className="mt-3 pt-3 border-t border-success-200 flex items-center justify-between">
                  <span className="text-xs text-success-800 font-medium">
                    Ready to refresh full suite with new data?
                  </span>
                  <button
                    onClick={onTriggerAnalysis}
                    className="btn-primary text-xs py-1.5 px-3 bg-success-700 hover:bg-success-800 border-none shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate Financial Analysis
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
