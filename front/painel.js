const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

(async () => {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const usuario = session.user;
  const dados = usuario.user_metadata || {};   
  const nome = dados.full_name || usuario.email;

  document.getElementById('usuarioNome').textContent = nome;

  const avatar = document.getElementById('usuarioFoto');
  if (dados.avatar_url) {
    avatar.style.backgroundImage = `url("${dados.avatar_url}")`;
    avatar.textContent = '';
  } else {
    avatar.textContent = nome.charAt(0).toUpperCase();   
  }
})();

document.getElementById('sair').addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.href = 'login.html';
});


const temperaturaAr = [23.5, 25.0, 24.2, 29.8, 27.4];
const umidadeSolo   = [38.0, 39.5, 42.5, 38.5, 42.8];

function criarLinha(valores, classe) {
  const largura = 500, altura = 180, margem = 14;
  const min = Math.min(...valores);
  const max = Math.max(...valores);

  const pontos = valores.map((valor, i) => {
    const x = (i / (valores.length - 1)) * largura;
    const y = altura - margem - ((valor - min) / (max - min)) * (altura - margem * 2);
    return `${x},${y}`;
  }).join(' ');

  return `<polyline class="linha ${classe}" points="${pontos}"/>`;
}

function desenharGrafico() {
  let grade = '';
  for (let i = 0; i < 5; i++) {
    const y = (180 / 4) * i;
    grade += `<line class="grade" x1="0" y1="${y}" x2="500" y2="${y}"/>`;
  }

  document.getElementById('grafico').innerHTML =
    grade + criarLinha(temperaturaAr, 'linha-ar') + criarLinha(umidadeSolo, 'linha-solo');
}

desenharGrafico();

const LATITUDE = -18.456081409042635;
const LONGITUDE = -46.3682270038666;

function iconePorCodigo(codigo) {
  if (codigo <= 1) return 'bi-sun';
  if (codigo === 2) return 'bi-cloud-sun';
  if (codigo === 3) return 'bi-cloud';
  if (codigo <= 48) return 'bi-cloud-fog';
  if (codigo <= 57) return 'bi-cloud-drizzle';
  if (codigo <= 67 || (codigo >= 80 && codigo <= 82)) return 'bi-cloud-rain';
  if (codigo <= 77) return 'bi-snow';
  if (codigo >= 95) return 'bi-cloud-lightning-rain';
  return 'bi-cloud';
}

async function carregarPrevisao() {
  const lista = document.getElementById('previsao');

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${LATITUDE}&longitude=${LONGITUDE}`
    + '&daily=weather_code,temperature_2m_max,precipitation_probability_max'
    + '&timezone=America%2FSao_Paulo&forecast_days=5';

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error('Falha ao buscar a previsão');
    const { daily } = await resposta.json();

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    lista.innerHTML = daily.time.map((data, i) => {
      const dia = diasSemana[new Date(data + 'T12:00:00').getDay()];
      const chuva = daily.precipitation_probability_max[i] ?? 0;
      const texto = chuva === 0 ? 'Sem Chuva' : `Chuva: ${chuva}%`;
      const icone = iconePorCodigo(daily.weather_code[i]);
      const temperatura = Math.round(daily.temperature_2m_max[i]);

      return `<li>
        <b>${dia}</b>
        <span><i class="bi ${icone} ambar"></i> ${texto}</span>
        <strong>${temperatura}°</strong>
      </li>`;
    }).join('');

  } catch (erro) {
    lista.innerHTML = '<li class="aviso">Não foi possível carregar a previsão.</li>';
  }
}

carregarPrevisao();