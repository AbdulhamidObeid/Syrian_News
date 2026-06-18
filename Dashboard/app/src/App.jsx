import React, { useEffect, useState } from 'react';
import './App.css';

// SVG Icons as components
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);

const platformConfig = {
  facebook:  { name: 'Facebook',  icon: FacebookIcon,  color: 'var(--color-facebook)' },
  instagram: { name: 'Instagram', icon: InstagramIcon, color: 'var(--color-instagram)' },
  telegram:  { name: 'Telegram',  icon: TelegramIcon,  color: 'var(--color-telegram)' },
  x:         { name: 'X',         icon: XIcon,         color: 'var(--color-x)' },
  tiktok:    { name: 'TikTok',    icon: TikTokIcon,    color: 'var(--color-tiktok)' },
};

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function PlatformCard({ platform, data, index }) {
  const config = platformConfig[platform];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div
      className={`platform-card animate-in stagger-${index + 1}`}
      style={{ '--platform-color': config.color }}
    >
      <div className="card-top">
        <div className="platform-icon">
          <Icon />
        </div>
        <div className={`connection-dot ${data.connected ? 'connected' : 'disconnected'}`}
             title={data.connected ? 'Connected' : 'Not Connected'} />
      </div>
      <div className="platform-name">{config.name}</div>
      <div className="follower-count">{formatNumber(data.followers)}</div>
      <div className="follower-label">followers</div>
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/stats.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setStats(data))
      .catch(err => {
        console.error("Failed to fetch stats:", err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <div className="loading-screen">
        <div style={{ color: 'var(--crimson)', fontSize: 14, fontFamily: 'var(--font-mono)' }}>
          Failed to load stats: {error}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Run <code style={{ color: 'var(--teal)' }}>node Dashboard/update_stats.js</code> first
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div className="loading-text">جاري تحميل البيانات...</div>
      </div>
    );
  }

  const platformOrder = ['facebook', 'instagram', 'tiktok', 'x', 'telegram'];

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header animate-in">
        <div className="header-left">
          <h1 className="brand-name">
            <span>هاشتاق سوريا</span>
          </h1>
          <div className="header-subtitle">
            Analytics Dashboard — HashSYR24
          </div>
        </div>
        <div className="header-right">
          <div className="last-updated">{formatTime(stats.lastUpdated)}</div>
          <div className="status-badge">
            <div className="status-dot" />
            Live
          </div>
        </div>
      </header>

      {/* Total Audience Hero */}
      <section className="audience-hero animate-in stagger-1">
        <div className="audience-label">Total Audience</div>
        <div className="audience-number">{formatNumber(stats.kpis.totalAudience)}</div>
        <div className="audience-sub">across {Object.values(stats.platforms).filter(p => p.connected).length} connected platforms</div>
      </section>

      {/* Platform Cards */}
      <section className="platforms-grid">
        {platformOrder.map((key, i) => (
          stats.platforms[key] && (
            <PlatformCard key={key} platform={key} data={stats.platforms[key]} index={i} />
          )
        ))}
      </section>

      {/* Bottom Stats */}
      <section className="bottom-grid">
        <div className="info-card animate-in stagger-4">
          <div className="info-card-header">
            <SendIcon /> Posts Published
          </div>
          <div className="info-card-value">{stats.kpis.postsPublished}</div>
          <div className="info-card-sub">articles curated & posted</div>
        </div>

        <div className="info-card animate-in stagger-5">
          <div className="info-card-header">
            <ActivityIcon /> Queue
          </div>
          <div className="info-card-value">{stats.kpis.pendingInMemory}</div>
          <div className="info-card-sub">posts pending in memory</div>
        </div>

        <div className="info-card animate-in stagger-6">
          <div className="info-card-header">
            <ServerIcon /> Pipeline
          </div>
          <div className={`pipeline-status ${stats.pipeline.status}`}>
            {stats.pipeline.status === 'operational' ? '● Operational' : '◌ Unknown'}
          </div>
          <div className="info-card-sub">
            {stats.pipeline.lastRun
              ? `Last run: ${formatTime(stats.pipeline.lastRun)}`
              : 'No pipeline run recorded'}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer animate-in">
        HashSYR24 · هاشتاق سوريا · Powered by AI Pipeline
      </footer>
    </div>
  );
}
