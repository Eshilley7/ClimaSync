const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const MODO_TESTE = true;
 
function nomeDoEmail(email) {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .filter(Boolean)
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ') || email;
}
 
function mostrarUsuario(nome, fotoUrl) {
  const avatar = document.getElementById('usuarioFoto');
  document.getElementById('usuarioNome').textContent = nome;
 
  if (fotoUrl) {
    avatar.style.backgroundImage = `url("${fotoUrl}")`;
    avatar.textContent = '';
  } else {
    avatar.textContent = nome.charAt(0).toUpperCase();
  }
}
 
async function verificarLogin() {
  const { data } = await db.auth.getSession();
  const sessao = data.session;
 
  if (!sessao) {
    if (MODO_TESTE) {
      mostrarUsuario('Visitante (teste)');
    } else {
      window.location.href = 'login.html';
    }
    return;
  }
 
  const usuario = sessao.user;
  const dados = usuario.user_metadata || {};
  mostrarUsuario(dados.full_name || nomeDoEmail(usuario.email), dados.avatar_url);
}
 
verificarLogin();
 
document.getElementById('sair').addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.href = 'login.html';
});