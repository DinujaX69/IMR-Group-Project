/* Tensorly front-end: vanilla JS single-page app. Talks to the REST API in server/server.js */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const day = (d) => (d ? String(d).slice(0, 10) : '-');
const badge = (s) => `<span class="badge s-${esc(String(s).replace(/ /g, ''))}">${esc(s)}</span>`;
const stars = (n) => (n == null ? 'No ratings yet' : Number(n).toFixed(2) + ' / 5');
const state = { token: sessionStorage.getItem('token'), user: JSON.parse(sessionStorage.getItem('user') || 'null'), lookups: null, view: null };
const actions = {};

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { logout(); throw new Error(data.error); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3200);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

/* ---------- generic UI helpers ---------- */
function table(rows, cols, rowActions) {
  if (!rows.length) return '<div class="empty">Nothing to show yet.</div>';
  const head = cols.map((c) => `<th class="${c.num ? 'num' : ''}">${c.label}</th>`).join('') + (rowActions ? '<th></th>' : '');
  const body = rows.map((r) => '<tr>' + cols.map((c) => {
    const v = c.fmt ? c.fmt(r[c.k], r) : esc(r[c.k]);
    return `<td class="${c.num ? 'num' : ''}">${v}</td>`;
  }).join('') + (rowActions ? `<td>${rowActions(r)}</td>` : '') + '</tr>').join('');
  return `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const M = (k, label) => ({ k, label, num: true, fmt: (v) => money(v) });
const D = (k, label) => ({ k, label, fmt: (v) => day(v) });
const B = (k, label = 'Status') => ({ k, label, fmt: (v) => badge(v) });
const T = (k, label) => ({ k, label });
function bars(rows, label, value, fmt = (v) => v) {
  const max = Math.max(...rows.map((r) => Number(r[value])), 1);
  if (!rows.length) return '<div class="empty">No data.</div>';
  return rows.map((r) => `<div class="bar"><span>${esc(r[label])}</span><i style="width:${(Number(r[value]) / max) * 100}%"></i><b class="num">${fmt(r[value])}</b></div>`).join('');
}
function modal(title, html) {
  closeModal();
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'modal';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${html}</div>`;
  o.addEventListener('click', (e) => { if (e.target === o) closeModal(); });
  document.body.appendChild(o);
  const f = o.querySelector('input,select,textarea,button'); if (f) f.focus();
}
const closeModal = () => $('#modal')?.remove();
const formData = (form) => Object.fromEntries(new FormData(form));
const opts = (rows, v, l, sel) => rows.map((r) => `<option value="${r[v]}" ${r[v] == sel ? 'selected' : ''}>${esc(r[l])}</option>`).join('');
const head = (t, s) => `<h2>${t}</h2><p class="sub">${s}</p>`;

/* ---------- auth ---------- */
actions.authTab = (d) => {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.t === d.t));
  $('#loginForm').hidden = d.t !== 'login'; $('#registerForm').hidden = d.t !== 'register'; $('#authMsg').textContent = '';
};
actions.fill = (d) => { const f = $('#loginForm'); f.email.value = d.e; f.password.value = 'Password@123'; };
const forms = {
  async login(f) {
    const r = await api('/auth/login', 'POST', formData(f));
    state.token = r.token; state.user = r.user;
    sessionStorage.setItem('token', r.token); sessionStorage.setItem('user', JSON.stringify(r.user));
    await start();
  },
  async register(f) {
    await api('/auth/register', 'POST', formData(f));
    actions.authTab({ t: 'login' }); $('#authMsg').className = 'msg ok'; $('#authMsg').textContent = 'Account created. Sign in to continue.';
  },
};
function logout() { api('/auth/logout', 'POST').catch(() => {}); sessionStorage.clear(); location.reload(); }
actions.logout = logout;

/* ---------- navigation ---------- */
const NAV = {
  Freelancer: [['fDash', 'Overview'], ['fFind', 'Find projects'], ['fProposals', 'My proposals'], ['work', 'My projects'], ['pay', 'Payments'], ['fProfile', 'Profile and skills'], ['reviews', 'Reviews'], ['disputes', 'Disputes']],
  Client: [['cProjects', 'My projects'], ['work', 'Active work'], ['pay', 'Payments'], ['cProfile', 'Organization'], ['reviews', 'Reviews'], ['disputes', 'Disputes']],
  Admin: [['reports', 'Overview and reports'], ['aUsers', 'Accounts'], ['aCatalog', 'Skills and services'], ['aProjects', 'Projects'], ['aProposals', 'Proposals'], ['aPayments', 'Payments'], ['aDisputes', 'Disputes']],
  Manager: [['reports', 'Overview and reports'], ['aProjects', 'Projects']],
};
async function start() {
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#whoName').textContent = state.user.name; $('#whoRole').textContent = state.user.role;
  state.lookups = await api('/lookups');
  $('#nav').innerHTML = NAV[state.user.role].map(([k, l]) => `<button data-act="go" data-v="${k}">${l}</button>`).join('');
  go(NAV[state.user.role][0][0]);
}
actions.go = (d) => go(d.v);
const go = guard(async (v) => {
  state.view = v;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  $('#main').innerHTML = '<p class="sub">Loading...</p>';
  $('#main').innerHTML = await views[v]();
  $('#main').focus();
});
const refresh = () => go(state.view);

/* ---------- views ---------- */
const views = {
  /* ===== Freelancer ===== */
  async fDash() {
    const [me, work, props] = await Promise.all([api('/freelancer/me'), api('/assignments'), api('/freelancer/proposals')]);
    const earned = (await api('/payments')).filter((p) => p.Status === 'Completed').reduce((s, p) => s + Number(p.NetAmount), 0);
    return head(`Welcome, ${esc(me.profile.FullName)}`, 'Your work and earnings at a glance.') + `<div class="stats">
      <div class="stat"><b>${stars(me.profile.AvgRating)}</b><span>Client rating</span></div>
      <div class="stat"><b>${work.filter((w) => w.AssignmentStatus === 'Active').length}</b><span>Active projects</span></div>
      <div class="stat"><b>${props.filter((p) => p.Status === 'Pending').length}</b><span>Proposals awaiting reply</span></div>
      <div class="stat"><b>${money(earned)}</b><span>Net earnings</span></div></div>
      <div class="panel"><h3>Current projects</h3>${table(work.filter((w) => w.AssignmentStatus === 'Active'), [T('Title', 'Project'), T('Client', 'Client'), M('AgreedAmount', 'Agreed'), M('AmountPaid', 'Paid'), M('Outstanding', 'Outstanding')])}</div>`;
  },
  async fFind() {
    const rows = await api('/projects/open');
    return head('Find projects', 'Open AI projects you can bid on.') + (rows.length ? `<div class="cards">${rows.map((p) => `<article class="pcard">
      <h3>${esc(p.Title)}</h3><div class="meta">${esc(p.Client)} - ${esc(p.CategoryName)} - due ${day(p.Deadline)}</div>
      <div>${esc(p.Description)}</div><div class="skills">${(p.RequiredSkills || '').split(', ').filter(Boolean).map((s) => `<span>${esc(s)}</span>`).join('')}</div>
      <div class="row" style="margin:0"><b>${money(p.Budget)}</b><span class="meta">${p.ProposalCount} proposals</span>
      ${p.AlreadyProposed ? '<span class="badge">Proposal sent</span>' : `<button class="btn sm" data-act="bid" data-id="${p.ProjectID}" data-t="${esc(p.Title)}" data-b="${p.Budget}">Submit proposal</button>`}</div></article>`).join('')}</div>` : '<div class="empty">No open projects right now.</div>');
  },
  async fProposals() {
    const rows = await api('/freelancer/proposals');
    return head('My proposals', 'Track every bid you have placed.') + `<div class="panel">${table(rows, [T('Title', 'Project'), T('Client', 'Client'), M('BidAmount', 'Bid'), T('DeliveryDays', 'Days'), D('SubmittedAt', 'Sent'), B('Status')],
      (r) => (r.Status === 'Pending' ? `<button class="btn ghost sm" data-act="withdraw" data-id="${r.ProposalID}">Withdraw</button>` : ''))}</div>`;
  },
  async work() {
    const rows = await api('/assignments'); const client = state.user.role === 'Client';
    return head(client ? 'Active work' : 'My projects', client ? 'Pay freelancers, review finished work, and raise issues.' : 'Projects you have been selected for.') +
      `<div class="panel">${table(rows, [T('Title', 'Project'), T(client ? 'Freelancer' : 'Client', client ? 'Freelancer' : 'Client'), M('AgreedAmount', 'Agreed'), M('AmountPaid', 'Paid'), M('Outstanding', 'Outstanding'), B('AssignmentStatus', 'Status')],
        (r) => `<div class="inline">${client && r.AssignmentStatus === 'Active' ? `<button class="btn sm" data-act="payForm" data-id="${r.AssignmentID}" data-o="${r.Outstanding}" data-t="${esc(r.Title)}">Pay</button>` : ''}
        ${r.AssignmentStatus === 'Completed' && !r.Reviewed ? `<button class="btn ghost sm" data-act="reviewForm" data-id="${r.AssignmentID}">Review</button>` : ''}
        <button class="btn ghost sm" data-act="disputeForm" data-id="${r.ProjectID}">Report issue</button></div>`)}</div>`;
  },
  async pay() {
    const rows = await api('/payments');
    return head('Payments', 'Every payment with platform fee and net amount.') + `<div class="panel">${table(rows, [T('Title', 'Project'), M('Amount', 'Amount'), M('PlatformFee', 'Platform fee'), M('NetAmount', 'Net to freelancer'), T('Method', 'Method'), B('Status'), D('PaymentDate', 'Date')])}</div>`;
  },
  async fProfile() {
    const { profile: p, skills, services } = await api('/freelancer/me'); const L = state.lookups;
    return head('Profile and skills', 'Clients see this when they review your proposals.') + `
      <div class="panel"><h3>Profile - rated ${stars(p.AvgRating)}</h3><form data-form="fProfile">
        <div class="inline"><label>Full name<input name="fullName" value="${esc(p.FullName)}" required></label><label>Country<input name="country" value="${esc(p.Country)}" required></label></div>
        <div class="inline"><label>Hourly rate (USD)<input name="hourlyRate" type="number" min="1" step="0.01" value="${p.HourlyRate}" required></label><label>Years of experience<input name="experienceYears" type="number" min="0" max="60" value="${p.ExperienceYears}" required></label></div>
        <label>Bio<textarea name="bio" maxlength="500">${esc(p.Bio)}</textarea></label><div><button class="btn">Save profile</button></div></form></div>
      <div class="grid2"><div class="panel"><h3>My AI skills</h3>${table(skills, [T('SkillName', 'Skill'), T('ProficiencyLevel', 'Level'), T('YearsExperience', 'Years')], (r) => `<button class="btn ghost sm" data-act="rmSkill" data-id="${r.SkillID}">Remove</button>`)}
        <form data-form="addSkill" class="inline" style="margin-top:12px"><label>Skill<select name="skillId">${opts(L.skills, 'SkillID', 'SkillName')}</select></label>
        <label>Level<select name="level"><option>Beginner</option><option>Intermediate</option><option selected>Advanced</option><option>Expert</option></select></label>
        <label>Years<input name="years" type="number" min="0" max="40" value="1"></label><button class="btn sm">Add or update</button></form></div>
      <div class="panel"><h3>AI services I offer</h3>${table(services, [T('ServiceName', 'Service'), M('Price', 'Price'), T('DeliveryDays', 'Days')], (r) => `<button class="btn ghost sm" data-act="rmService" data-id="${r.ServiceID}">Remove</button>`)}
        <form data-form="addService" class="inline" style="margin-top:12px"><label>Service<select name="serviceId">${opts(L.services.filter((s) => s.IsActive), 'ServiceID', 'ServiceName')}</select></label>
        <label>Price<input name="price" type="number" min="1" step="0.01" required></label><label>Days<input name="days" type="number" min="1" required></label><button class="btn sm">Add or update</button></form></div></div>`;
  },
  async reviews() {
    const rows = await api('/reviews');
    return head('Reviews', 'What the other party said about working with you.') + `<div class="panel">${table(rows, [T('Title', 'Project'), T('Rating', 'Rating (1-5)'), T('Comment', 'Comment'), D('CreatedAt', 'Date')])}</div>`;
  },
  async disputes() {
    const rows = await api('/disputes/mine');
    return head('Disputes', 'Issues you reported. Use "Report issue" on any project to add one.') + `<div class="panel">${table(rows, [T('Title', 'Project'), T('Subject', 'Subject'), B('Status'), T('Resolution', 'Resolution'), D('CreatedAt', 'Raised')])}</div>`;
  },

  /* ===== Client ===== */
  async cProjects() {
    const rows = await api('/client/projects');
    return `<div class="row"><div>${head('My projects', 'Post AI projects, compare proposals and pick a freelancer.')}</div><button class="btn" data-act="newProject">Post a project</button></div>
      <div class="panel">${table(rows, [T('Title', 'Project'), T('CategoryName', 'Category'), M('Budget', 'Budget'), D('Deadline', 'Deadline'), T('ProposalCount', 'Proposals'), B('Status')],
        (r) => `<div class="inline"><button class="btn ghost sm" data-act="proposals" data-id="${r.ProjectID}" data-t="${esc(r.Title)}" data-s="${r.Status}">Proposals</button>
        ${r.Status === 'Open' ? `<button class="btn ghost sm" data-act="matches" data-id="${r.ProjectID}">Suggested freelancers</button><button class="btn ghost sm" data-act="cancelProject" data-id="${r.ProjectID}">Cancel</button>` : ''}</div>`)}</div>`;
  },
  async cProfile() {
    const { profile: p } = await api('/client/me');
    return head('Organization', `Your profile - rated ${stars(p.AvgRating)} by freelancers.`) + `<div class="panel"><form data-form="cProfile">
      <div class="inline"><label>Organization<input name="organizationName" value="${esc(p.OrganizationName)}" required></label><label>Contact name<input name="contactName" value="${esc(p.ContactName)}" required></label></div>
      <div class="inline"><label>Country<input name="country" value="${esc(p.Country)}" required></label><label>Industry<input name="industry" value="${esc(p.Industry)}"></label></div>
      <div><button class="btn">Save changes</button></div></form></div>`;
  },

  /* ===== Admin / Manager ===== */
  async reports() {
    const [k, rev, fr, cl, sv, pm] = await Promise.all(['kpis', 'revenue', 'freelancers', 'clients', 'services', 'payments'].map((x) => api('/reports/' + x)));
    const K = k.kpis;
    return head('Platform overview', 'Live figures from the database views and stored procedures.') + `<div class="stats">
      <div class="stat"><b>${K.Projects}</b><span>Projects (${K.OpenProjects} open, ${K.ActiveProjects} active)</span></div>
      <div class="stat"><b>${K.Freelancers} / ${K.Clients}</b><span>Freelancers / clients</span></div>
      <div class="stat"><b>${money(K.GrossVolume)}</b><span>Gross payment volume</span></div>
      <div class="stat"><b>${money(K.PlatformRevenue)}</b><span>Platform revenue (10% fee)</span></div>
      <div class="stat"><b>${K.OpenDisputes}</b><span>Unresolved disputes</span></div></div>
      <div class="grid2"><div class="panel"><h3>Monthly revenue</h3><form data-form="revFilter" class="inline"><label>From<input type="date" name="from"></label><label>To<input type="date" name="to"></label><button class="btn sm">Apply</button></form>
        <div id="revBars" style="margin-top:12px">${bars(rev, 'Month', 'GrossVolume', money)}</div></div>
      <div class="panel"><h3>Projects by AI category</h3>${bars(k.byCategory, 'CategoryName', 'Projects')}<h3 style="margin-top:18px">Most requested skills</h3>${bars(k.skillDemand, 'SkillName', 'Demand')}</div></div>
      <div class="panel"><h3>Freelancer performance</h3>${table(fr, [T('FullName', 'Freelancer'), T('Country', 'Country'), T('TotalProjects', 'Projects'), T('CompletedProjects', 'Done'), M('NetEarnings', 'Net earnings'), { k: 'AvgRating', label: 'Rating', fmt: (v) => v ?? '-' }])}</div>
      <div class="panel"><h3>Client activity</h3>${table(cl, [T('OrganizationName', 'Client'), T('Industry', 'Industry'), T('ProjectsPosted', 'Posted'), T('CompletedProjects', 'Done'), M('TotalBudget', 'Budget'), M('TotalPaid', 'Paid'), { k: 'AvgRating', label: 'Rating', fmt: (v) => v ?? '-' }])}</div>
      <div class="panel"><h3>AI services: supply and demand</h3>${table(sv, [T('ServiceName', 'Service'), T('CategoryName', 'Category'), M('BaseRate', 'Base rate'), T('FreelancersOffering', 'Offered by'), M('AvgPrice', 'Avg price'), T('ProjectsInCategory', 'Projects in category')])}</div>
      <div class="panel"><h3>Project payment summary</h3>${table(pm, [T('Title', 'Project'), T('Client', 'Client'), T('Freelancer', 'Freelancer'), M('AgreedAmount', 'Agreed'), M('AmountPaid', 'Paid'), M('Outstanding', 'Outstanding'), M('PlatformFees', 'Fees'), B('ProjectStatus', 'Status')])}</div>`;
  },
  async aUsers() {
    const rows = await api('/admin/users');
    return head('Accounts', 'Activate or deactivate freelancer and client accounts.') + `<div class="panel">${table(rows, [T('Name', 'Name'), T('Email', 'Email'), T('Role', 'Role'), { k: 'IsActive', label: 'Status', fmt: (v) => badge(v ? 'Active' : 'Terminated').replace('Terminated', 'Deactivated') }, D('CreatedAt', 'Joined')],
      (r) => (r.Role === 'Admin' ? '' : `<button class="btn ghost sm" data-act="toggleUser" data-id="${r.UserID}" data-a="${r.IsActive ? 0 : 1}">${r.IsActive ? 'Deactivate' : 'Activate'}</button>`))}</div>`;
  },
  async aCatalog() {
    const L = state.lookups;
    return head('Skills and services', 'Manage categories, AI skills and the service catalogue.') + `<div class="grid2">
      <div class="panel"><h3>Categories (${L.categories.length})</h3>${table(L.categories, [T('CategoryName', 'Category')])}
        <form data-form="newCat" class="inline" style="margin-top:12px"><label>Name<input name="name" required></label><label>Description<input name="description"></label><button class="btn sm">Add</button></form></div>
      <div class="panel"><h3>AI skills (${L.skills.length})</h3>${table(L.skills, [T('SkillName', 'Skill'), T('CategoryName', 'Category')])}
        <form data-form="newSkill" class="inline" style="margin-top:12px"><label>Name<input name="name" required></label><label>Category<select name="categoryId">${opts(L.categories, 'CategoryID', 'CategoryName')}</select></label><button class="btn sm">Add</button></form></div></div>
      <div class="panel"><h3>AI service catalogue</h3>${table(L.services, [T('ServiceName', 'Service'), M('BaseRate', 'Base rate'), { k: 'IsActive', label: 'Status', fmt: (v) => badge(v ? 'Active' : 'Terminated').replace('Terminated', 'Hidden') }],
        (r) => `<button class="btn ghost sm" data-act="toggleService" data-id="${r.ServiceID}">${r.IsActive ? 'Hide' : 'Show'}</button>`)}
        <form data-form="newService" class="inline" style="margin-top:12px"><label>Name<input name="name" required></label><label>Category<select name="categoryId">${opts(L.categories, 'CategoryID', 'CategoryName')}</select></label>
        <label>Base rate<input name="baseRate" type="number" min="1" step="0.01" required></label><label>Description<input name="description"></label><button class="btn sm">Add</button></form></div>`;
  },
  async aProjects() {
    const rows = await api('/admin/projects');
    return head('Projects', 'All projects on the platform.') + `<div class="panel">${table(rows, [T('Title', 'Project'), T('Client', 'Client'), T('CategoryName', 'Category'), M('Budget', 'Budget'), D('Deadline', 'Deadline'), T('Proposals', 'Proposals'), B('Status')])}</div>`;
  },
  async aProposals() {
    const rows = await api('/admin/proposals');
    return head('Proposals', 'Every proposal submitted by freelancers.') + `<div class="panel">${table(rows, [T('Title', 'Project'), T('Freelancer', 'Freelancer'), M('BidAmount', 'Bid'), T('DeliveryDays', 'Days'), D('SubmittedAt', 'Sent'), B('Status')])}</div>`;
  },
  async aPayments() {
    const rows = await api('/admin/payments');
    return head('Payments', 'All payment records.') + `<div class="panel">${table(rows, [T('Title', 'Project'), M('Amount', 'Amount'), M('PlatformFee', 'Fee'), T('Method', 'Method'), B('Status'), D('PaymentDate', 'Date')])}</div>`;
  },
  async aDisputes() {
    const rows = await api('/admin/disputes');
    return head('Disputes', 'Review complaints and record how they were resolved.') + `<div class="panel">${table(rows, [T('Title', 'Project'), T('RaisedBy', 'Raised by'), T('Subject', 'Subject'), T('Description', 'Details'), B('Status'), T('Resolution', 'Resolution')],
      (r) => `<button class="btn ghost sm" data-act="resolve" data-id="${r.DisputeID}" data-s="${r.Status}" data-r="${esc(r.Resolution)}">Update</button>`)}</div>`;
  },
};

/* ---------- click actions ---------- */
const act = (fn) => guard(fn);
actions.bid = (d) => modal('Proposal for ' + d.t, `<form data-form="bid" data-id="${d.id}">
  <label>Your bid (USD) - budget is ${money(d.b)}<input name="bid" type="number" min="1" step="0.01" required></label>
  <label>Delivery time (days)<input name="days" type="number" min="1" required></label>
  <label>Cover letter<textarea name="cover" maxlength="1000" required placeholder="Describe your approach and relevant experience"></textarea></label>
  <div><button class="btn">Send proposal</button> <button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
actions.close = closeModal;
actions.withdraw = act(async (d) => { await api(`/proposals/${d.id}/withdraw`, 'POST'); toast('Proposal withdrawn'); refresh(); });
actions.rmSkill = act(async (d) => { await api('/freelancer/skills/' + d.id, 'DELETE'); refresh(); });
actions.rmService = act(async (d) => { await api('/freelancer/services/' + d.id, 'DELETE'); refresh(); });
actions.newProject = () => {
  const L = state.lookups;
  modal('Post an AI project', `<form data-form="newProject"><label>Title<input name="title" required maxlength="150"></label>
    <label>Description<textarea name="description" required maxlength="1000"></textarea></label>
    <div class="inline"><label>Category<select name="categoryId">${opts(L.categories, 'CategoryID', 'CategoryName')}</select></label>
    <label>Budget (USD)<input name="budget" type="number" min="1" step="0.01" required></label><label>Deadline<input name="deadline" type="date" required></label></div>
    <label>Required skills</label><div class="checks">${L.skills.map((s) => `<label><input type="checkbox" name="skill" value="${s.SkillID}">${esc(s.SkillName)}</label>`).join('')}</div>
    <div><button class="btn">Post project</button> <button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
};
actions.proposals = act(async (d) => {
  const rows = await api(`/projects/${d.id}/proposals`);
  modal('Proposals: ' + d.t, table(rows, [T('FullName', 'Freelancer'), M('BidAmount', 'Bid'), T('DeliveryDays', 'Days'), { k: 'AvgRating', label: 'Rating', fmt: (v) => v ?? '-' }, M('HourlyRate', 'Rate/hr'), B('Status')],
    (r) => `<div><button class="btn ghost sm" data-act="coverView" data-c="${esc(r.CoverLetter)}">Letter</button>${d.s === 'Open' && r.Status === 'Pending' ? ` <button class="btn sm" data-act="accept" data-id="${r.ProposalID}">Select</button>` : ''}</div>`));
});
actions.coverView = (d) => alert(d.c);
actions.accept = act(async (d) => { await api(`/proposals/${d.id}/accept`, 'POST'); closeModal(); toast('Freelancer selected. Project is now in progress.'); refresh(); });
actions.matches = act(async (d) => {
  const rows = await api(`/projects/${d.id}/matches`);
  modal('Suggested freelancers', table(rows, [T('FullName', 'Freelancer'), T('MatchedSkills', 'Matched'), T('MatchingSkills', 'Skills'), M('HourlyRate', 'Rate/hr'), { k: 'AvgRating', label: 'Rating', fmt: (v) => v ?? '-' }]));
});
actions.cancelProject = act(async (d) => { if (confirm('Cancel this project?')) { await api(`/projects/${d.id}/cancel`, 'POST'); refresh(); } });
actions.payForm = (d) => modal('Pay for ' + d.t, `<form data-form="pay" data-id="${d.id}">
  <label>Amount (outstanding ${money(d.o)})<input name="amount" type="number" min="1" max="${d.o}" step="0.01" value="${d.o}" required></label>
  <label>Method<select name="method"><option>Credit Card</option><option>Bank Transfer</option><option>PayPal</option></select></label>
  <p class="meta">A 10% platform fee is deducted from the freelancer's payout.</p><div><button class="btn">Confirm payment</button> <button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
actions.reviewForm = (d) => modal('Leave a review', `<form data-form="review" data-id="${d.id}">
  <label>Rating<select name="rating"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Fair</option><option value="2">2 - Poor</option><option value="1">1 - Very poor</option></select></label>
  <label>Comment<textarea name="comment" maxlength="500"></textarea></label><div><button class="btn">Submit review</button> <button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
actions.disputeForm = (d) => modal('Report an issue', `<form data-form="dispute" data-id="${d.id}"><label>Subject<input name="subject" required maxlength="120"></label>
  <label>What happened?<textarea name="description" required maxlength="600"></textarea></label><div><button class="btn">Send to admin</button> <button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
actions.toggleUser = act(async (d) => { await api('/admin/users/' + d.id, 'PATCH', { isActive: d.a === '1' }); refresh(); });
actions.toggleService = act(async (d) => { await api('/admin/services/' + d.id, 'PATCH'); state.lookups = await api('/lookups'); refresh(); });
actions.resolve = (d) => modal('Update dispute', `<form data-form="resolve" data-id="${d.id}"><label>Status<select name="status">${['Open', 'Under Review', 'Resolved', 'Closed'].map((s) => `<option ${s === d.s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
  <label>Resolution notes<textarea name="resolution" maxlength="500">${esc(d.r)}</textarea></label><div><button class="btn">Save</button> <button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);

/* ---------- form handlers ---------- */
Object.assign(forms, {
  async bid(f) { await api('/proposals', 'POST', { projectId: f.dataset.id, ...formData(f) }); closeModal(); toast('Proposal sent'); refresh(); },
  async fProfile(f) { await api('/freelancer/me', 'PUT', formData(f)); toast('Profile saved'); refresh(); },
  async addSkill(f) { await api('/freelancer/skills', 'PUT', formData(f)); refresh(); },
  async addService(f) { await api('/freelancer/services', 'PUT', formData(f)); refresh(); },
  async cProfile(f) { await api('/client/me', 'PUT', formData(f)); toast('Saved'); },
  async newProject(f) {
    const b = formData(f); b.skillIds = [...f.querySelectorAll('input[name=skill]:checked')].map((c) => c.value); delete b.skill;
    await api('/projects', 'POST', b); closeModal(); toast('Project posted'); refresh();
  },
  async pay(f) { await api('/payments', 'POST', { assignmentId: f.dataset.id, ...formData(f) }); closeModal(); toast('Payment recorded'); refresh(); },
  async review(f) { await api('/reviews', 'POST', { assignmentId: f.dataset.id, ...formData(f) }); closeModal(); toast('Review submitted'); refresh(); },
  async dispute(f) { await api('/disputes', 'POST', { projectId: f.dataset.id, ...formData(f) }); closeModal(); toast('Issue sent to the admin team'); },
  async resolve(f) { await api('/admin/disputes/' + f.dataset.id, 'PATCH', formData(f)); closeModal(); refresh(); },
  async newCat(f) { await api('/admin/categories', 'POST', formData(f)); state.lookups = await api('/lookups'); refresh(); },
  async newSkill(f) { await api('/admin/skills', 'POST', formData(f)); state.lookups = await api('/lookups'); refresh(); },
  async newService(f) { await api('/admin/services', 'POST', formData(f)); state.lookups = await api('/lookups'); refresh(); },
  async revFilter(f) {
    const d = formData(f); const q = new URLSearchParams(Object.entries(d).filter(([, v]) => v)).toString();
    $('#revBars').innerHTML = bars(await api('/reports/revenue?' + q), 'Month', 'GrossVolume', money);
  },
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el.dataset, el);
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  try { await forms[f.dataset.form](f); }
  catch (err) { if (f.dataset.form === 'login' || f.dataset.form === 'register') { $('#authMsg').className = 'msg'; $('#authMsg').textContent = err.message; } else toast(err.message, true); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

if (state.token && state.user) start().catch(() => logout());
