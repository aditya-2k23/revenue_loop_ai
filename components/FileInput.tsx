import { forwardRef, useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import Papa from "papaparse";

export const FileInput = forwardRef<
  HTMLInputElement,
  { label: string; accept: string; id: string }
>(function FileInput({ label, accept, id }, forwardedRef) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof forwardedRef === "function") {
      forwardedRef(inputRef.current);
    } else if (forwardedRef) {
      forwardedRef.current = inputRef.current;
    }
  }, [forwardedRef]);

  const handleFile = (newFile: File | null) => {
    setFile(newFile);
    setError(null);
    setRowCount(null);
    
    if (!newFile) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!newFile.name.toLowerCase().endsWith('.csv') && newFile.type !== 'text/csv') {
      setError("Only CSV files are supported");
      return;
    }

    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(newFile);
      inputRef.current.files = dt.files;
    }

    setIsParsing(true);
    Papa.parse(newFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRowCount(results.data.length);
        setIsParsing(false);
      },
      error: () => {
        setError("Failed to read CSV");
        setIsParsing(false);
      }
    });
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    } else {
      handleFile(null);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFile(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
        {label}
      </span>
      
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 group focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-transparent outline-none
          ${error ? "border-red-500/50 bg-red-500/5 hover:bg-red-500/10" 
            : file ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
            : isDragging ? "border-blue-500/50 bg-blue-500/10" 
            : "border-white/10 bg-zinc-950/50 hover:bg-zinc-900/50 hover:border-white/20"}`}
      >
        <input
          type="file"
          accept={accept}
          id={id}
          ref={inputRef}
          onChange={onChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus-visible:outline-none"
        />

        <div className="flex flex-col items-center justify-center p-4 text-center pointer-events-none w-full h-full">
          {!file ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 mb-3 ${isDragging ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-zinc-300">
                <span className="text-blue-400 group-hover:text-blue-300">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-zinc-500 mt-1">CSV files only</p>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2 relative h-full justify-center" title={file.name}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${error ? "text-red-400" : "text-emerald-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold text-zinc-200 truncate max-w-[80%] mx-auto">
                {file.name}
              </p>
              
              {isParsing ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Parsing...
                </span>
              ) : rowCount !== null ? (
                <span className="inline-flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  {rowCount.toLocaleString()} rows detected
                </span>
              ) : error ? (
                <span className="text-xs font-medium text-red-400">Invalid format</span>
              ) : null}

              {/* Clear button (pointer-events-auto so it can be clicked despite parent pointer-events-none) */}
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-0 right-0 p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                title="Clear file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </label>
      
      {/* Validation Message */}
      {error && (
        <p className="text-xs font-medium text-red-400 animate-in slide-in-from-top-1 fade-in">
          {error}
        </p>
      )}
    </div>
  );
});
