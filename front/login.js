const $ = id => document.getElementById(id);
const email = $('email'), senha = $('senha'), btn = $('submit'), toast = $('toast');

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

    await new Promise(r => setTimeout(r, 1200));
    btn.disabled = false;
    btn.textContent = 'Acessar Painel';
});
