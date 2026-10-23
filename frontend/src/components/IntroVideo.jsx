import React, { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const IntroVideo = ({ onComplete }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  const enableAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.defaultMuted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(error => {
        console.warn('Playback after unmuting encountered an issue:', error);
      });
      setIsMuted(false);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    if (isMuted) {
      enableAudio();
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  // 1. Cố gắng phát tự động kèm bật tiếng (unmuted autoplay) ngay khi tải
  // 2. Nếu chính sách trình duyệt chặn tiếng (NotAllowedError), chuyển sang phát có hình và lắng nghe tương tác đầu tiên để bật tiếng
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Thiết lập thuộc tính âm thanh trước khi gọi play()
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1.0;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsMuted(false);
        })
        .catch(error => {
          console.warn('Trình duyệt chặn tự động phát kèm tiếng, tạm tắt tiếng và chờ tương tác đầu tiên:', error);
          setIsMuted(true);
          video.muted = true;
          video.play().catch(mutedError => {
            console.error('Không thể phát video tự động:', mutedError);
          });
        });
    }

    // Tự động bật tiếng ngay khi người dùng chạm, click hoặc nhấn phím bất kỳ
    const handleFirstGesture = () => {
      if (videoRef.current && videoRef.current.muted) {
        enableAudio();
      }
    };

    const gestureEvents = ['click', 'touchstart', 'pointerdown', 'keydown'];
    gestureEvents.forEach(event => {
      window.addEventListener(event, handleFirstGesture, { once: true, capture: true });
    });

    return () => {
      gestureEvents.forEach(event => {
        window.removeEventListener(event, handleFirstGesture, { capture: true });
      });
    };
  }, []);

  return (
    <div
      onClick={isMuted ? enableAudio : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden ${
        isMuted ? 'cursor-pointer' : ''
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        onEnded={onComplete}
      >
        <source src="/video_intro.mp4" type="video/mp4" />
        Trình duyệt của bạn không hỗ trợ thẻ video.
      </video>

      {/* Thông báo gợi ý bật tiếng nếu trình duyệt tạm thời chặn âm thanh tự động */}
      {isMuted && (
        <div
          onClick={enableAudio}
          className="absolute top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 text-white text-sm font-medium rounded-full backdrop-blur-md border border-white/20 shadow-lg animate-pulse transition-all select-none"
        >
          <Volume2 className="h-4 w-4 text-emerald-400" />
          <span>Nhấp vào màn hình để bật âm thanh</span>
        </div>
      )}

      <div className="absolute bottom-10 right-10 z-50 flex gap-4">
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all flex items-center justify-center border border-white/20"
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-red-300" />
          ) : (
            <Volume2 className="h-5 w-5 text-emerald-400" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="px-6 py-2 bg-white/20 hover:bg-white/40 text-white font-medium rounded-full backdrop-blur-md transition-all border border-white/30"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
};

export default IntroVideo;
