const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const MODO_TESTE = true;

const LATITUDE = -18.456081409042635;
const LONGITUDE = -46.3682270038666;

const MINUTOS_PARA_ATUALIZAR = 30;

const temperaturaAr = [23.5, 25.0, 24.2, 29.8, 27.4];
const umidadeSolo   = [38.0, 39.5, 42.5, 38.5, 42.8];

const campoNome     = document.getElementById('usuarioNome');
const avatar        = document.getElementById('usuarioFoto');
const botaoSair     = document.getElementById('sair');
const graficoSvg    = document.getElementById('grafico');
const listaPrevisao = document.getElementById('previsao');


function nomeDoEmail(email) {
  const antesDoArroba = email.split('@')[0];

  return antesDoArroba
    .replace(/[._-]+/g, ' ')   
    .replace(/\d+/g, '')       
    .split(' ')
    .filter(Boolean)           
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ') || email;       
}

function mostrarUsuario(nome, fotoUrl) {
  campoNome.textContent = nome;

  if (fotoUrl) {
    avatar.style.backgroundImage = `url("${fotoUrl}")`;
    avatar.textContent = '';
  } else {
    avatar.textContent = nome.charAt(0).toUpperCase();
  }
}

async function pedirNome() {
  const resposta = prompt('Como devemos chamar você? (nome completo)');
  const nome = resposta ? resposta.trim() : '';
  if (!nome) return null;

  const { error } = await db.auth.updateUser({ data: { full_name: nome } });
  return error ? null : nome;
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
  let nome = dados.full_name;   

  if (!nome) {
    nome = nomeDoEmail(usuario.email);
    mostrarUsuario(nome, dados.avatar_url);

    if (!nome.includes(' ')) {
      const nomeInformado = await pedirNome();
      if (nomeInformado) nome = nomeInformado;
    }
  }
  mostrarUsuario(nome, dados.avatar_url);
}

verificarLogin();

botaoSair.addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.href = 'login.html';
});

const LARGURA = 500;
const ALTURA = 180;
const MARGEM = 14;

function criarLinha(valores, classe) {
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const diferenca = (maior - menor) || 1;   

  const pontos = valores.map((valor, i) => {
    const x = (i / (valores.length - 1)) * LARGURA;
    const y = ALTURA - MARGEM - ((valor - menor) / diferenca) * (ALTURA - MARGEM * 2);
    return `${x},${y}`;
  }).join(' ');

  return `<polyline class="linha ${classe}" points="${pontos}"/>`;
}

function desenharGrafico() {
  let grade = '';
  for (let i = 0; i < 5; i++) {
    const y = (ALTURA / 4) * i;
    grade += `<line class="grade" x1="0" y1="${y}" x2="${LARGURA}" y2="${y}"/>`;
  }

  graficoSvg.innerHTML =
    grade +
    criarLinha(temperaturaAr, 'linha-ar') +
    criarLinha(umidadeSolo, 'linha-solo');
}
desenharGrafico();

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
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${LATITUDE}&longitude=${LONGITUDE}`
    + '&daily=weather_code,temperature_2m_max,precipitation_probability_max'
    + '&timezone=America%2FSao_Paulo&forecast_days=5';

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error('Falha ao buscar a previsão');

    const { daily } = await resposta.json();
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    listaPrevisao.innerHTML = daily.time.map((data, i) => {
      const dia = diasSemana[new Date(data + 'T12:00:00').getDay()];
      const chuva = daily.precipitation_probability_max[i] ?? 0;
      const textoChuva = chuva === 0 ? 'Sem Chuva' : `Chuva: ${chuva}%`;
      const icone = iconePorCodigo(daily.weather_code[i]);
      const temperatura = Math.round(daily.temperature_2m_max[i]);

      return `<li>
        <b>${dia}</b>
        <span><i class="bi ${icone} ambar"></i> ${textoChuva}</span>
        <strong>${temperatura}°</strong>
      </li>`;
    }).join('');

  } catch (erro) {
    listaPrevisao.innerHTML = '<li class="aviso">Não foi possível carregar a previsão.</li>';
  }
}

carregarPrevisao();
setInterval(carregarPrevisao, MINUTOS_PARA_ATUALIZAR * 60 * 1000);