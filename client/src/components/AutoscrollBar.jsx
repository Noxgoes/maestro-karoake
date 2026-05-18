import React from 'react';

/**
 * AutoscrollBar component styled exactly like the KARA design system.
 * Warm parchment background (#F5F0E8), pill buttons, no shadows.
 */
export default function AutoscrollBar({ isScrolling, speed, setSpeed, toggle, reset }) {
  const displaySpeed = (speed / 100).toFixed(1);

  const handleDecrease = (e) => {
    e.stopPropagation();
    setSpeed(speed - 10);
  };

  const handleIncrease = (e) => {
    e.stopPropagation();
    setSpeed(speed + 10);
  };

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 20px',
      background: '#F5F0E8',
      borderBottom: '0.5px solid #E8E2D8',
      userSelect: 'none',
      width: '100%',
    }}>
      {/* 1. Autoscroll Toggle Button */}
      <button
        id="autoscroll-toggle"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className={isScrolling ? "btn-autoscroll-on" : "btn-autoscroll-off"}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 18px',
          borderRadius: '100px',
          fontSize: '13px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: '1.5px solid #1A1A1A',
          backgroundColor: isScrolling ? '#1A1A1A' : 'transparent',
          color: isScrolling ? '#F5F0E8' : '#1A1A1A',
          outline: 'none',
          boxShadow: 'none',
        }}
      >
        {isScrolling ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="4" height="16" rx="1"/>
              <rect x="16" y="4" width="4" height="16" rx="1"/>
            </svg>
            <span>Autoscroll</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Autoscroll</span>
          </>
        )}
      </button>

      {/* 2. Speed Control - only visible when autoscroll is ON */}
      {isScrolling && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          animation: 'fadeIn 0.2s ease-in-out',
        }}>
          <span style={{ fontSize: '12px', color: '#6B6560', fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Speed:
          </span>
          <button
            id="autoscroll-speed-down"
            disabled={speed <= 10}
            onClick={handleDecrease}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1px solid #1A1A1A',
              background: 'transparent',
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: speed <= 10 ? 'not-allowed' : 'pointer',
              opacity: speed <= 10 ? 0.3 : 1,
              fontWeight: 'bold',
              fontSize: '16px',
              padding: 0,
              outline: 'none',
            }}
          >
            −
          </button>
          <span style={{
            fontSize: '13px',
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#1A1A1A',
            minWidth: '24px',
            textAlign: 'center',
            transition: 'opacity 0.15s ease',
          }}>
            {displaySpeed}
          </span>
          <button
            id="autoscroll-speed-up"
            disabled={speed >= 200}
            onClick={handleIncrease}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1px solid #1A1A1A',
              background: 'transparent',
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: speed >= 200 ? 'not-allowed' : 'pointer',
              opacity: speed >= 200 ? 0.3 : 1,
              fontWeight: 'bold',
              fontSize: '16px',
              padding: 0,
              outline: 'none',
            }}
          >
            +
          </button>
        </div>
      )}

      {/* 3. Reset Button */}
      <button
        id="autoscroll-reset"
        onClick={(e) => { e.stopPropagation(); reset(); }}
        style={{
          marginLeft: 'auto',
          padding: '6px 14px',
          borderRadius: '100px',
          border: '1px solid rgba(26,26,26,0.3)',
          background: 'transparent',
          color: '#1A1A1A',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid #1A1A1A'; }}
        onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid rgba(26,26,26,0.3)'; }}
      >
        ↑ Top
      </button>

      {/* Embedded CSS for animations */}
      <style>{`
        @keyframes autoscroll-pulse {
          0% { border-color: #1A1A1A; }
          50% { border-color: rgba(26, 26, 26, 0.4); }
          100% { border-color: #1A1A1A; }
        }
        .btn-autoscroll-on {
          animation: autoscroll-pulse 2s infinite ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
