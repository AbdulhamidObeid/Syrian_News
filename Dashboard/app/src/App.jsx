import React, { useEffect, useState } from 'react';
import './App.css';

// ── SVG Icons ──────────────────────────────────────────────
const FacebookIcon  = ({ size=20 }) => (<svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>);
const InstagramIcon = ({ size=20 }) => (<svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>);
const TelegramIcon  = ({ size=20 }) => (<svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>);
const XIcon         = ({ size=18 }) => (<svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>);
const SendIcon      = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>);
const ServerIcon    = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>);
const LibraryIcon   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>);
const EyeIcon       = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
const HeartIcon     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
const CommentIcon   = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
const ShareIcon     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>);
const SaveIcon      = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>);
const RepeatIcon    = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>);
const TrendingIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>);
const BarChartIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
const CheckIcon     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
const ClockIcon     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const LockIcon      = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);

// ── Platform Config ──────────────────────────────────────────
const platformConfig = {
  facebook:  { name: 'Facebook',  Icon: FacebookIcon,  color: 'var(--color-facebook)' },
  instagram: { name: 'Instagram', Icon: InstagramIcon, color: 'var(--color-instagram)' },
  telegram:  { name: 'Telegram',  Icon: TelegramIcon,  color: 'var(--color-telegram)' },
  x:         { name: 'X',         Icon: XIcon,         color: 'var(--color-x)' },
};

const pillarEmoji = { did_you_know: '💡', poll_opinion: '📊', infographic: '📈', world_cup: '⚽' };

// ── Formatters ───────────────────────────────────────────────
function fmt(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12: false });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}

// ── Metric Chip ─────────────────────────────────────────────
function Metric({ icon: Icon, label, value, locked }) {
  return (
    <div className="metric-chip">
      <div className="metric-icon">{locked ? <LockIcon /> : <Icon />}</div>
      <div className="metric-body">
        <div className={`metric-value ${locked ? 'metric-locked' : ''}`}>
          {locked ? '—' : fmt(value)}
        </div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

// ── Platform Insights Panel ──────────────────────────────────
function PlatformPanel({ platform, followers, connected, insights }) {
  const cfg = platformConfig[platform];
  if (!cfg) return null;
  const { Icon } = cfg;

  const metricRows = {
    facebook: [
      { icon: EyeIcon,     label: 'Weekly Views',        value: insights?.weeklyViews,    locked: false },
      { icon: HeartIcon,   label: 'Engagements',         value: insights?.weeklyEngaged,  locked: false },
      { icon: HeartIcon,   label: 'Post Likes',          value: insights?.postsLikes,     locked: false },
      { icon: CommentIcon, label: 'Comments',            value: insights?.postsComments,  locked: false },
      { icon: ShareIcon,   label: 'Shares',              value: insights?.postsShares,    locked: false },
      { icon: TrendingIcon,label: 'New Followers (wk)',  value: insights?.weeklyNewFollows, locked: false },
    ],
    instagram: [
      { icon: EyeIcon,     label: 'Weekly Reach',        value: insights?.weeklyReach,        locked: false },
      { icon: HeartIcon,   label: 'Total Interactions',  value: insights?.totalInteractions,   locked: false },
      { icon: HeartIcon,   label: 'Likes',               value: insights?.likes,               locked: false },
      { icon: CommentIcon, label: 'Comments',            value: insights?.comments,            locked: false },
      { icon: SaveIcon,    label: 'Saves',               value: insights?.saves,               locked: false },
      { icon: ShareIcon,   label: 'Shares',              value: insights?.shares,              locked: false },
      { icon: EyeIcon,     label: 'Profile Views',       value: insights?.profileViews,        locked: false },
    ],
    x: [
      { icon: EyeIcon,     label: 'Impressions',         value: insights?.weeklyImpressions,  locked: true, lockReason: 'X Basic plan required' },
      { icon: HeartIcon,   label: 'Likes',               value: insights?.weeklyLikes,        locked: true },
      { icon: RepeatIcon,  label: 'Retweets',            value: insights?.weeklyRetweets,     locked: true },
      { icon: CommentIcon, label: 'Replies',             value: insights?.weeklyReplies,      locked: true },
    ],
    telegram: [
      { icon: TrendingIcon, label: 'Members',            value: insights?.members,            locked: false },
    ],
  };

  const rows = metricRows[platform] || [];

  return (
    <div className="platform-panel" style={{ '--pcolor': cfg.color }}>
      <div className="platform-panel-header">
        <div className="platform-panel-icon">
          <Icon size={22} />
        </div>
        <div className="platform-panel-info">
          <div className="platform-panel-name">{cfg.name}</div>
          <div className="platform-panel-followers">{fmt(followers || 0)} followers</div>
        </div>
        <div className={`platform-panel-dot ${connected ? 'connected' : 'disconnected'}`} />
      </div>

      <div className="metrics-row">
        {rows.map((m, i) => (
          <Metric key={i} icon={m.icon} label={m.label} value={m.value} locked={m.locked} />
        ))}
      </div>

      {platform === 'x' && (
        <div className="platform-panel-note">
          <LockIcon /> Analytics require X Basic API plan
        </div>
      )}
      {platform === 'telegram' && (
        <div className="platform-panel-note">
          Message-level views available via Bot polling
        </div>
      )}
    </div>
  );
}

// ── Platform Card (followers only) ──────────────────────────
function PlatformCard({ platform, data, index }) {
  const cfg = platformConfig[platform];
  if (!cfg) return null;
  const { Icon } = cfg;
  return (
    <div className={`platform-card animate-in stagger-${index + 1}`} style={{ '--platform-color': cfg.color }}>
      <div className="card-top">
        <div className="platform-icon"><Icon size={20} /></div>
        <div className={`connection-dot ${data.connected ? 'connected' : 'disconnected'}`} />
      </div>
      <div className="platform-name">{cfg.name}</div>
      <div className="follower-count">{fmt(data.followers)}</div>
      <div className="follower-label">followers</div>
    </div>
  );
}

// ── Weekly Bar ───────────────────────────────────────────────
function WeeklyBar({ weeklyPostCounts }) {
  if (!weeklyPostCounts || !Object.keys(weeklyPostCounts).length) return null;
  const entries = Object.entries(weeklyPostCounts);
  const maxC = Math.max(...entries.map(([, v]) => v), 1);
  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="weekly-bar-section">
      <div className="section-header"><BarChartIcon /><span>Weekly Activity</span></div>
      <div className="weekly-bar-chart">
        {entries.map(([date, count]) => {
          const isToday = date === today;
          const h = Math.max((count / maxC) * 100, 4);
          const day = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
          return (
            <div key={date} className="bar-column">
              <div className="bar-count">{count > 0 ? count : ''}</div>
              <div className={`bar-fill ${isToday ? 'bar-today' : ''}`} style={{ height: `${h}%` }} title={`${date}: ${count}`} />
              <div className={`bar-label ${isToday ? 'bar-label-today' : ''}`}>{day}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top Post Card ────────────────────────────────────────────
function TopPostCard({ post, index }) {
  if (!post) return null;
  return (
    <div className={`top-post-card animate-in stagger-${index + 1}`}>
      {post.thumbnail && (
        <div className="top-post-thumb"><img src={post.thumbnail} alt="post" loading="lazy" /></div>
      )}
      <div className="top-post-body">
        <div className="top-post-meta">
          <span className="top-post-platform"><FacebookIcon size={12} /> Facebook</span>
          <span className="top-post-date">{fmtDate(post.createdAt)}</span>
        </div>
        <div className="top-post-message" dir="rtl">{post.message || '—'}</div>
        <div className="top-post-stats">
          <span className="post-stat"><EyeIcon />{fmt(post.reach)}</span>
          <span className="post-stat"><HeartIcon />{fmt(post.likes)}</span>
          <span className="post-stat"><CommentIcon />{fmt(post.comments)}</span>
          <span className="post-stat"><ShareIcon />{fmt(post.shares)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Content Pillar Tracker ───────────────────────────────────
function ContentPillarTracker({ pillars }) {
  if (!pillars?.length) return null;
  return (
    <div className="pillar-section">
      <div className="section-header"><span>📋</span><span>Content Pillars — Today's Schedule</span></div>
      <div className="pillar-grid">
        {pillars.map(p => (
          <div key={p.id} className={`pillar-card ${p.postedToday ? 'pillar-done' : 'pillar-pending'}`}>
            <div className="pillar-emoji">{pillarEmoji[p.id] || '📌'}</div>
            <div className="pillar-info">
              <div className="pillar-name" dir="rtl">{p.nameArabic}</div>
              <div className="pillar-frequency">
                {p.frequency === 'daily' ? 'يومياً' : p.frequency === 'every_2_days' ? 'كل يومين' : p.frequency === 'every_3_days' ? 'كل 3 أيام' : p.frequency === 'event_based' ? 'حسب الأحداث' : p.frequency}
                {p.preferredTime && ` · ${p.preferredTime}`}
              </div>
            </div>
            <div className={`pillar-status ${p.postedToday ? 'pillar-status-done' : 'pillar-status-pending'}`}>
              {p.postedToday ? <><CheckIcon /> Done</> : <><ClockIcon /> Pending</>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/stats.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setStats)
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div className="loading-screen">
      <div style={{ color: 'var(--crimson)', fontSize: 14 }}>Error: {error}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Run <code style={{ color: 'var(--teal)' }}>node Dashboard/update_stats.js</code></div>
    </div>
  );

  if (!stats) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <div className="loading-text">جاري تحميل البيانات...</div>
    </div>
  );

  const platformOrder   = ['facebook', 'instagram', 'x', 'telegram'];
  const hasTopPosts     = stats.topPosts?.length > 0;

  return (
    <div className="dashboard">

      {/* Header */}
      <header className="header animate-in">
        <div className="header-left">
          <h1 className="brand-name"><span>هاشتاق سوريا</span></h1>
          <div className="header-subtitle">Analytics Dashboard — HashSYR24</div>
        </div>
        <div className="header-right">
          <div className="last-updated">{fmtTime(stats.lastUpdated)}</div>
          <div className="status-badge"><div className="status-dot" /> Live</div>
        </div>
      </header>

      {/* Total Audience Hero */}
      <section className="audience-hero animate-in stagger-1">
        <div className="audience-label">Total Audience</div>
        <div className="audience-number">{fmt(stats.kpis.totalAudience)}</div>
        <div className="audience-sub">across {Object.values(stats.platforms).filter(p => p.connected).length} connected platforms</div>
      </section>

      {/* Platform Follower Cards */}
      <section className="platforms-grid">
        {platformOrder.map((key, i) => stats.platforms[key] && (
          <PlatformCard key={key} platform={key} data={stats.platforms[key]} index={i} />
        ))}
      </section>

      {/* ── PER-PLATFORM INSIGHTS ── */}
      <section className="insights-section animate-in stagger-2">
        <div className="section-header"><TrendingIcon /><span>Platform Analytics — This Week</span></div>
        <div className="platform-panels-grid">
          {platformOrder.map(key => (
            <PlatformPanel
              key={key}
              platform={key}
              followers={stats.platforms[key]?.followers}
              connected={stats.platforms[key]?.connected}
              insights={stats.platformInsights?.[key]}
            />
          ))}
        </div>
      </section>

      {/* KPI Row */}
      <section className="bottom-grid animate-in stagger-3">
        <div className="info-card">
          <div className="info-card-header"><SendIcon /> Posts Published</div>
          <div className="info-card-value">{stats.kpis.postsPublished}</div>
          <div className="info-card-sub">all-time articles posted</div>
        </div>
        <div className="info-card">
          <div className="info-card-header"><LibraryIcon /> Story Library</div>
          <div className="info-card-value">{stats.kpis.storyLibrary}</div>
          <div className="info-card-sub">curated articles ready to post</div>
        </div>
        <div className="info-card">
          <div className="info-card-header"><ServerIcon /> Pipeline</div>
          <div className={`pipeline-status ${stats.pipeline.status}`}>
            {stats.pipeline.status === 'operational' ? '● Operational' : '◌ Unknown'}
          </div>
          <div className="info-card-sub">
            {stats.pipeline.lastRun ? `Last run: ${fmtTime(stats.pipeline.lastRun)}` : 'No pipeline run recorded'}
          </div>
        </div>
      </section>

      {/* Weekly Bar */}
      {stats.kpis?.weeklyPostCounts && <WeeklyBar weeklyPostCounts={stats.kpis.weeklyPostCounts} />}

      {/* Content Pillars */}
      <ContentPillarTracker pillars={stats.contentPillars} />

      {/* Top Posts */}
      <section className="top-posts-section animate-in">
        <div className="section-header"><TrendingIcon /><span>Top Performing Posts — Double Down on These</span></div>
        {hasTopPosts ? (
          <div className="top-posts-list">
            {stats.topPosts.map((post, i) => <TopPostCard key={post.id} post={post} index={i} />)}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">No post engagement data yet</div>
            <div className="empty-sub">Post insights will appear here as your content gains reach and engagement.</div>
          </div>
        )}
      </section>

      <footer className="footer animate-in">HashSYR24 · هاشتاق سوريا · Powered by AI Pipeline</footer>
    </div>
  );
}
