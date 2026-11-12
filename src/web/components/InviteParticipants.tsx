import { useState, type FormEvent } from 'react';
import { api, describeError } from '../lib/api.js';
import { useApp } from '../lib/store.js';
import { useI18n } from '../lib/i18n.js';

/** Organizer-only creation; links are bearer credentials, shared privately by the host. */
export function InviteParticipants() {
  const { state, refresh, mock } = useApp();
  const { locale } = useI18n();
  const zh = locale === 'zh' || locale === 'zh-TW';
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invites, setInvites] = useState<Array<{ name: string; url: string }>>([]);
  const [copied, setCopied] = useState<string | null>(null);
  if (!state?.workshop || state.session.role !== 'organizer') return null;
  const closed = Boolean(state.offer) || !['COLLECTING_INTEREST', 'CLARIFYING'].includes(state.workshop.status);
  const full = state.participants.length >= 12;
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy || full || mock || closed) return;
    setBusy(true); setError('');
    try {
      const result = await api.addParticipant(name.trim());
      if (!result.inviteToken) throw new Error('The server did not return an invitation. Please retry.');
      const url = new URL(`/p/${encodeURIComponent(result.inviteToken)}`, window.location.origin).href;
      setInvites((current) => [...current, { name: name.trim(), url }]);
      setName(''); setCopied(null);
      await refresh(true);
    } catch (cause) { setError(describeError(cause)); }
    finally { setBusy(false); }
  }
  return <section className="panel invite-panel" aria-labelledby="invite-title">
    <h2 id="invite-title">{zh ? '邀请参与者' : 'Invite participants'}</h2>
    {!closed && <p className="muted">{zh ? '为每位参与者创建独立链接。只有本人确认的偏好才计入计划。' : 'Create one private link per person. Their preferences count only after they confirm.'}</p>}
    {closed && <p role="status">{zh ? '此活动已发布固定报价或已结束，不能新增参与者。已有邀请链接仍可使用，原有参与者可查看自己的状态。' : 'New invitations are closed: this workshop has a published offer or has ended. Existing invitation links still work so participants can view their status.'}</p>}
    {!closed && <form onSubmit={(event) => void create(event)} className="invite-form" aria-busy={busy}>
      <label htmlFor="invite-name">{zh ? '参与者姓名' : 'Participant name'}
        <input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" required disabled={busy || full || mock || closed} />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy || full || mock || closed || !name.trim()}>{busy ? (zh ? '创建中…' : 'Creating…') : (zh ? '创建邀请' : 'Create invitation')}</button>
    </form>}
    <p className="invite-feedback" role="status" aria-live="polite">{busy ? (zh ? '正在创建私密邀请…' : 'Creating a private invitation…') : copied ? (zh ? '链接已复制，请私下发送给参与者。' : 'Link copied. Share it privately with your participant.') : invites.length > 0 ? (zh ? '邀请已创建，请复制下方链接。' : 'Invitation ready. Copy the link below.') : ''}</p>
    {full && <p role="status">{zh ? '此原型每场活动最多支持12位参与者。' : 'This prototype supports up to 12 participants per workshop.'}</p>}
    {mock && <p>{zh ? '请退出静态预览以创建真实邀请。' : 'Leave the static preview to create a real invitation.'}</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
    {invites.map((invite) => <div className="invite-link" key={invite.url}>
      <strong>{invite.name}</strong>
      <input aria-label={zh ? `${invite.name} 的私密邀请链接` : `Private invitation for ${invite.name}`} value={invite.url} readOnly onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-secondary btn-small" type="button" onClick={async () => { try { await navigator.clipboard.writeText(invite.url); setCopied(invite.url); } catch { setError(zh ? '请选中链接并手动复制。' : 'Select the link and copy it manually.'); } }}>{copied === invite.url ? (zh ? '已复制' : 'Copied') : (zh ? '复制链接' : 'Copy link')}</button>
    </div>)}
    {invites.length > 0 && <p className="muted">{zh ? '链接仅在此显示一次，请现在复制并私下发送。任何持有链接的人都可代表该参与者操作。当前本地地址只能在本机使用，不是公网链接。' : 'Copy and privately share these links now; they are shown only in this session. Anyone with a link can act as that participant. A localhost link works only on this computer, not over the internet.'}</p>}
  </section>;
}
