
document.addEventListener('DOMContentLoaded', () => {
  const modalSolicitacao = document.getElementById('modalSolicitacao');
  const botaoAbrir = document.getElementById('abrirSolicitacao');
  const botaoFechar = document.getElementById('fecharSolicitacao');
  const formulario = document.getElementById('formSolicitacao');
  const botaoEnviar = document.getElementById('enviarSolicitacao');
  const aviso = document.getElementById('avisoSolicitacao');

  if (
    !modalSolicitacao ||
    !botaoAbrir ||
    !botaoFechar ||
    !formulario ||
    !botaoEnviar ||
    !aviso
  ) {
    console.error('Elementos do formulário não encontrados.');
    return;
  }

  const supabaseSolicitacao = window.supabase.createClient(
    'https://ygkvynojfoejztrlsujf.supabase.co',
    'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );

  function mostrarAviso(mensagem, sucesso = false) {
    aviso.textContent = mensagem;
    aviso.style.color = sucesso ? '#0cc18c' : '#ff6679';
  }

  function obterCampo(dados, nome, id) {
    return String(
      dados.get(nome) ||
      document.getElementById(id)?.value ||
      ''
    ).trim();
  }

  botaoAbrir.addEventListener('click', evento => {
    evento.preventDefault();
    aviso.textContent = '';
    modalSolicitacao.showModal();
  });

  botaoFechar.addEventListener('click', () => {
    modalSolicitacao.close();
  });

  modalSolicitacao.addEventListener('click', evento => {
    if (evento.target === modalSolicitacao) {
      modalSolicitacao.close();
    }
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();

    aviso.textContent = '';

    const formData = new FormData(formulario);

    const nome = obterCampo(formData, 'nome', 'solNome');
    const email = obterCampo(formData, 'email', 'solEmail').toLowerCase();
    const telefone = obterCampo(formData, 'telefone', 'solTelefone');
    const perfil = obterCampo(formData, 'perfil', 'solPerfil');
    const motivo = obterCampo(formData, 'motivo', 'solMotivo');

    const senha = obterCampo(formData, 'senha', 'solSenha');
    const confirmarSenha = obterCampo(
      formData,
      'confirmarSenha',
      'solConfirmarSenha'
    );

    if (nome.length < 3) {
      mostrarAviso('Informe seu nome completo.');
      return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailValido.test(email)) {
      mostrarAviso('Informe um e-mail válido.');
      return;
    }

    if (!perfil) {
      mostrarAviso('Selecione um perfil.');
      return;
    }

    if (motivo.length < 10) {
      mostrarAviso('Explique melhor o motivo da solicitação.');
      return;
    }

    if (senha.length < 8) {
      mostrarAviso('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      mostrarAviso('As senhas não coincidem.');
      return;
    }

    const textoOriginal = botaoEnviar.innerHTML;

    botaoEnviar.disabled = true;
    botaoEnviar.innerHTML =
      '<i class="bi bi-hourglass-split"></i> Enviando...';

    aviso.style.color = '#8a96ad';
    aviso.textContent = 'Criando conta e enviando solicitação...';

    try {
      const { data: solicitacoesExistentes, error: erroConsulta } =
        await supabaseSolicitacao
          .from('solicitacoes_acesso')
          .select('id, status')
          .eq('email', email)
          .in('status', ['pendente', 'aprovada'])
          .limit(1);

      if (erroConsulta) {
        console.warn('Não foi possível consultar solicitações anteriores:', erroConsulta);
      }

      if (solicitacoesExistentes?.length) {
        const status = solicitacoesExistentes[0].status;

        if (status === 'pendente') {
          throw new Error(
            'Já existe uma solicitação pendente para este e-mail.'
          );
        }

        throw new Error(
          'Este e-mail já possui uma solicitação aprovada. Entre em contato com a gerência.'
        );
      }

      const { data: cadastro, error: erroCadastro } =
        await supabaseSolicitacao.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              full_name: nome
            }
          }
        });

      if (erroCadastro) {
        throw new Error(erroCadastro.message);
      }

      if (!cadastro?.user) {
        throw new Error(
          'Não foi possível confirmar a criação da conta.'
        );
      }

      if (
        cadastro.user.identities &&
        cadastro.user.identities.length === 0
      ) {
        throw new Error(
          'Este e-mail já possui uma conta. Entre em contato com a gerência.'
        );
      }

      const { error: erroSolicitacao } =
        await supabaseSolicitacao
          .from('solicitacoes_acesso')
          .insert({
            nome,
            email,
            telefone: telefone || null,
            perfil,
            motivo,
            status: 'pendente'
          });

      if (erroSolicitacao) {
        console.error('Erro ao registrar solicitação:', erroSolicitacao);

        throw new Error(
          'A conta pode ter sido criada, mas a solicitação não foi registrada. Entre em contato com a gerência antes de tentar novamente.'
        );
      }

      mostrarAviso(
        'Solicitação enviada com sucesso! Confirme seu e-mail, se solicitado, e aguarde a aprovação do administrador.',
        true
      );

      formulario.reset();

    } catch (erro) {
      console.error('Erro ao solicitar acesso:', erro);

      mostrarAviso(
        erro.message ||
        'Não foi possível enviar a solicitação.'
      );

    } finally {
      botaoEnviar.disabled = false;
      botaoEnviar.innerHTML = textoOriginal;
    }
  });
});
