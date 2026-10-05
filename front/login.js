const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const $ = id => document.getElementById(id);
const email = $('email'), senha = $('senha'), btn = $('submit'), toast = $('toast');

db.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'painel.html';
});

$('toggle').addEventListener('click', e => {
  const show = senha.type === 'password';
  senha.type = show ? 'text' : 'password';
  $('iconeOlho').className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
  e.currentTarget.setAttribute('aria-pressed', show);
  e.currentTarget.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
});

const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const mark = (box, bad) => box.classList.toggle('invalido', bad);
email.addEventListener('input', () => mark($('emailBox'), false));
senha.addEventListener('input', () => mark($('senhaBox'), false));

$('login').addEventListener('submit', async e => {
  e.preventDefault();
  toast.textContent = '';
  const badEmail = !validEmail(email.value.trim());
  const badSenha = senha.value.length < 6;
  mark($('emailBox'), badEmail);
  mark($('senhaBox'), badSenha);
  if (badEmail) return email.focus();
  if (badSenha) return senha.focus();

  btn.disabled = true;
  btn.innerHTML = '<span class="carregando"></span> Entrando...';

  const { error } = await db.auth.signInWithPassword({
    email: email.value.trim(),
    password: senha.value
  });

  btn.disabled = false;
  btn.textContent = 'Acessar Painel';

  if (error) {
  console.log('Erro do Supabase:', error.message);
  toast.textContent = error.message;
  } else {
    window.location.href = 'painel.html';
  }
  });

$('google').addEventListener('click', async () => {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('painel.html', window.location.href).href
    }
  });

  if (error) toast.textContent = 'Erro ao entrar com Google: ' + error.message;
});

const parametros = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
const erroNaUrl = parametros.get('error_description');

if (erroNaUrl) {
  toast.textContent = erroNaUrl;
  toast.classList.add('com-erro');
}