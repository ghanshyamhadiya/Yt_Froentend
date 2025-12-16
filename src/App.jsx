import React, { useState } from 'react';
import { Download, Video, Loader2, CheckCircle, XCircle, Info, Music, Clock, Gauge } from 'lucide-react';

// Simplified API URL definition
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Converts seconds into a human-readable duration format (e.g., '01:35' or '1:10:30').
 * @param {number | string} seconds - The duration in seconds.
 * @returns {string} The formatted duration string.
 */
const formatDuration = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return 'N/A';
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [m, s];
    if (h > 0) parts.unshift(h);
    
    return parts.map((n, index) => {
        if (h > 0 && index > 0) return n.toString().padStart(2, '0');
        if (h === 0) return n.toString().padStart(2, '0');
        return n.toString();
    }).join(':');
};

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadDetails, setDownloadDetails] = useState({});
  const [currentSession, setCurrentSession] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      setVideoInfo(null);
      return;
    }

    setLoading(true);
    setError('');
    setVideoInfo(null);
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/video-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch video info');
      }
      
      const data = await response.json();
      setVideoInfo({
          ...data,
          duration: formatDuration(data.duration_seconds) 
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch video information');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (formatId = null, isAudio = false) => {
    setDownloading(true);
    setProgress(0);
    setDownloadDetails({});
    setError('');
    setSuccess('');
    setCurrentSession(null);

    try {
      const payload = { 
        url, 
        format_id: formatId, 
        is_audio: isAudio 
      };

      // 1. Start Download Session
      const startRes = await fetch(`${API_URL}/start-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!startRes.ok) {
        const errData = await startRes.json();
        throw new Error(errData.error || 'Failed to start download');
      }
      
      const { session_id: sessionId } = await startRes.json();
      setCurrentSession(sessionId);

      // 2. Poll for Progress
      const interval = setInterval(async () => {
        try {
          const progRes = await fetch(`${API_URL}/progress/${sessionId}`);
          
          if (!progRes.ok) {
            console.error('Progress check request failed');
            return;
          }
          
          const progressData = await progRes.json();
          const { progress: p, error: err, status, downloaded, total, speed, eta } = progressData;
          
          setProgress(p || 0);
          setDownloadDetails({ status, downloaded, total, speed, eta });

          if (err) {
            clearInterval(interval);
            setError(err);
            setDownloading(false);
            setCurrentSession(null);
            setProgress(0);
            setDownloadDetails({});
            return;
          }

          if (p >= 100) {
            clearInterval(interval);
            
            // 3. Fetch the downloaded file
            try {
              const fileRes = await fetch(`${API_URL}/file/${sessionId}`);
              
              if (!fileRes.ok) {
                throw new Error('File download failed on server/network');
              }
              
              const blob = await fileRes.blob();
              const downloadUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = downloadUrl;

              const contentDisposition = fileRes.headers.get('content-disposition');
              const filename = contentDisposition
                ? contentDisposition.split('filename=')[1].replace(/"/g, '').split(';')[0]
                : `${videoInfo?.title?.substring(0, 50) || 'download'}.${isAudio ? 'mp3' : 'mp4'}`;

              link.setAttribute('download', filename);
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(downloadUrl);

              setSuccess(`Download of "${filename}" completed successfully!`);
              setDownloading(false);
              setCurrentSession(null);
              setProgress(0);
              setDownloadDetails({});
            } catch (fileErr) {
              setError('Failed to download file: ' + fileErr.message);
              setDownloading(false);
              setCurrentSession(null);
              setProgress(0);
              setDownloadDetails({});
            }
          }
        } catch (progressErr) {
          clearInterval(interval);
          setError('Download progress check failed');
          setDownloading(false);
          setCurrentSession(null);
          setProgress(0);
          setDownloadDetails({});
        }
      }, 750); 

    } catch (err) {
      setError(err.message || 'Download failed to start');
      setDownloading(false);
      setProgress(0);
      setDownloadDetails({});
    }
  };

  const isVideoLoading = loading && !downloading;

  return (
    // Dark background, minimal padding
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-10">
      <div className="mx-auto max-w-4xl">
        
        {/* Header Section */}
        <header className="text-center mb-10 pb-4 border-b border-gray-700">
          <div className="flex items-center justify-center gap-3">
            <Video className="w-9 h-9 md:w-10 md:h-10 text-red-500" />
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              UltraDownloader
            </h1>
          </div>
          <p className="text-gray-400 mt-2 text-lg">Fast, Free YouTube Video & Audio Downloads</p>
        </header>

        {/* Input & Get Info Section */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube URL here..."
              // Dark mode input styling
              className="px-4 py-3 w-full border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-4 focus:ring-red-900 focus:border-red-500 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && !isVideoLoading && fetchVideoInfo()}
            />
            <button
              onClick={fetchVideoInfo}
              disabled={isVideoLoading || downloading}
              // Primary button styling
              className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 active:bg-red-700 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold whitespace-nowrap"
            >
              {isVideoLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Info className="w-5 h-5" />
                  Get Video Info
                </>
              )}
            </button>
          </div>
        </section>

        {/* Alerts Section (Error, Success, Downloading) */}
        <section className="mb-8">
          {/* Error Alert - High Contrast Red */}
          {error && (
            <div className="p-4 bg-red-900 border-l-4 border-red-500 text-red-100 flex items-start gap-3 mb-4 rounded-md">
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}
          
          {/* Success Alert - High Contrast Green */}
          {success && (
            <div className="p-4 bg-green-900 border-l-4 border-green-500 text-green-100 flex items-start gap-3 mb-4 rounded-md">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{success}</span>
            </div>
          )}
          
          {/* Downloading Progress Bar - High Contrast Blue/Gray */}
          {downloading && (
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-400 font-bold">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span>{downloadDetails.status || 'Processing...'}</span>
                </div>
                <span className="text-blue-400 font-extrabold text-xl">{Math.round(progress)}%</span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
              
              {/* Download Details Grid */}
              {downloadDetails.speed && downloadDetails.speed !== 'N/A' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 text-xs md:text-sm text-blue-300">
                  <div className="flex items-center gap-1 font-semibold">
                    <Download className="w-4 h-4 text-blue-500" />
                    <span>DL: {downloadDetails.downloaded || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span>Total: {downloadDetails.total || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    <span>Speed: {downloadDetails.speed || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>ETA: {downloadDetails.eta || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Video Info and Download Options */}
        {videoInfo && (
          <div className="mt-6">
            
            {/* Video Metadata - Box-free look achieved with subtle background and strong separation */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 bg-gray-800 p-4 rounded-lg border-l-4 border-red-500 mb-8">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                // Use black border for thumbnail in dark mode
                className="w-full md:w-56 h-auto md:h-36 object-cover rounded-md border-2 border-black"
              />
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-extrabold text-white mb-2 line-clamp-2">{videoInfo.title}</h2>
                <div className="text-sm text-gray-400 space-y-1">
                  <p><span className="font-semibold text-gray-300">Channel:</span> {videoInfo.author}</p>
                  <p><span className="font-semibold text-gray-300">Duration:</span> {videoInfo.duration}</p>
                  <p><span className="font-semibold text-gray-300">Views:</span> {videoInfo.view_count?.toLocaleString() || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Audio Only Option - Prominent Green Bar */}
            <div className="mb-8 p-4 bg-gray-800 rounded-lg border-l-4 border-green-500">
              <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                <Music className="w-6 h-6" />
                Audio Only (MP3)
              </h3>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex flex-col">
                  <p className="text-lg font-bold text-white">High Quality MP3</p>
                  <p className="text-sm text-green-500">Best available audio stream (~192kbps)</p>
                </div>
                <button
                  onClick={() => handleDownload(null, true)}
                  disabled={downloading}
                  // Secondary button styling
                  className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 active:bg-green-700 transition-colors disabled:bg-gray-600 flex items-center justify-center gap-2 font-medium"
                >
                  <Download className="w-5 h-5" />
                  Download MP3
                </button>
              </div>
            </div>

            {/* Video Formats List - Box-free look with separators */}
            <div className="pt-6 border-t border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Video className="w-6 h-6 text-red-500" />
                Video Formats Available
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                {videoInfo.formats
                  .filter(format => format.resolution && format.quality !== 'audio only') 
                  .sort((a, b) => {
                    const resA = parseInt(a.resolution?.replace('p', '')) || 0;
                    const resB = parseInt(b.resolution?.replace('p', '')) || 0;
                    return resB - resA; 
                  })
                  .map((format, index) => (
                  <div
                    key={format.format_id || index}
                    // Box-free look using border-b for separation
                    className="flex items-center justify-between gap-4 py-3 border-b border-gray-700 hover:bg-gray-800 transition-colors px-2 rounded-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-white">{format.resolution} <span className="text-xs font-normal text-gray-500">({format.fps || 30}fps)</span></p>
                      <p className="text-sm text-gray-400 font-medium">Quality: {format.quality}</p>
                      <p className="text-xs text-gray-500 truncate">
                        Size: <span className="font-semibold text-gray-300">{format.filesize !== 'Unknown' ? format.filesize : 'Estimating...'}</span>
                        {' • '}
                        <span className="font-extrabold text-red-500">{format.ext.toUpperCase()}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(format.format_id, false)}
                      disabled={downloading}
                      className="flex-shrink-0 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:bg-gray-600 flex items-center gap-2 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Footer/How-to Section */}
        <div className="mt-10 pt-6 border-t border-gray-700">
          <h3 className="font-bold text-lg text-white mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            Simple Steps
          </h3>
          <ol className="list-decimal list-inside text-gray-400 space-y-2 text-base">
            <li>Copy the **YouTube video URL**.</li>
            <li>**Paste** it into the input field above.</li>
            <li>Click **"Get Video Info"** to see available formats.</li>
            <li>Choose your preferred **video or MP3 audio** format and click **Download**.</li>
          </ol>
        </div>

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Built for Speed and Reliability • Dark Mode Minimalist Design</p>
        </footer>
      </div>
    </div>
  );
}

export default App;