import React, { useRef, useState, useEffect } from 'react';

const IntroVideo = ({ onComplete }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  // Attempt to play with sound, if blocked by browser policy, fallback to muted
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log("Autoplay with sound failed, falling back to muted autoplay", error);
        setIsMuted(true);
        videoRef.current.play();
      });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted={isMuted}
        playsInline
        className="w-full h-full object-cover"
        onEnded={onComplete}
      >
        <source src="/video_intro.mp4" type="video/mp4" />
        Trình duyệt của bạn không hỗ trợ thẻ video.
      </video>
      
      <div className="absolute bottom-10 right-10 z-50 flex gap-4">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all flex items-center justify-center border border-white/20"
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
          )}
        </button>
        <button
          onClick={onComplete}
          className="px-6 py-2 bg-white/20 hover:bg-white/40 text-white font-medium rounded-full backdrop-blur-md transition-all border border-white/30"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
};

export default IntroVideo;
