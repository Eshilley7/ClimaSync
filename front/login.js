const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const formulario  = document.getElementById('login');
const campoEmail  = document.getElementById('email');
const campoSenha  = document.getElementById('senha');
const caixaEmail  = document.getElementById('emailBox');
const caixaSenha  = document.getElementById('senhaBox');
const botaoEntrar = document.getElementById('submit');
const botaoOlho   = document.getElementById('toggle');
const iconeOlho   = document.getElementById('iconeOlho');
const botaoGoogle = document.getElementById('google');
const mensagem    = document.getElementById('toast');

function emailValido(texto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto);
}

function marcarCampo(caixa, comErro) {
  caixa.classList.toggle('invalido', comErro);
}

function mostrarErro(texto) {
  mensagem.textContent = texto;
  mensagem.classList.add('com-erro');
}

db.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = 'painel.html';
});

botaoOlho.addEventListener('click', () => {
  const estavaEscondida = campoSenha.type === 'password';

  campoSenha.type = estavaEscondida ? 'text' : 'password';
  iconeOlho.className = estavaEscondida ? 'bi bi-eye-slash' : 'bi bi-eye';
  botaoOlho.setAttribute('aria-label', estavaEscondida ? 'Ocultar senha' : 'Mostrar senha');
});

campoEmail.addEventListener('input', () => marcarCampo(caixaEmail, false));
campoSenha.addEventListener('input', () => marcarCampo(caixaSenha, false));

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();   // impede a página de recarregar
  mensagem.textContent = '';

  const email = campoEmail.value.trim();
  const senha = campoSenha.value;

  const emailInvalido = !emailValido(email);
  const senhaInvalida = senha.length < 6;
  marcarCampo(caixaEmail, emailInvalido);
  marcarCampo(caixaSenha, senhaInvalida);
  if (emailInvalido) return campoEmail.focus();
  if (senhaInvalida) return campoSenha.focus();

  botaoEntrar.disabled = true;
  botaoEntrar.innerHTML = '<span class="carregando"></span> Entrando...';

  const { error } = await db.auth.signInWithPassword({ email, password: senha });

  botaoEntrar.disabled = false;
  botaoEntrar.textContent = 'Acessar Painel';

  if (!error) {
    window.location.href = 'painel.html';
  } else if (error.message === 'Invalid login credentials') {
    mostrarErro('E-mail ou senha incorretos.');
  } else if (error.message === 'Email not confirmed') {
    mostrarErro('Confirme seu e-mail antes de entrar.');
  } else {
    mostrarErro('Não foi possível entrar. Tente novamente.');
  }
});

botaoGoogle.addEventListener('click', async () => {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL('painel.html', window.location.href).href }
  });

  if (error) mostrarErro('Não foi possível entrar com o Google. Tente novamente.');
});

const parametros = new URLSearchParams(window.location.hash.slice(1) || window.location.search);

if (parametros.get('error_description')) {
  mostrarErro('Não foi possível entrar com o Google. Seu e-mail pode não ter acesso. Solicite à gerência.');
}