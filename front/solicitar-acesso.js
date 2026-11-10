document.addEventListener('DOMContentLoaded', () => {

    const modalSolicitacao = document.getElementById('modalSolicitacao');
    const botaoAbrir = document.getElementById('abrirSolicitacao');
    const botaoFechar = document.getElementById('fecharSolicitacao');
    const formulario = document.getElementById('formSolicitacao');
    const botaoEnviar = document.getElementById('enviarSolicitacao');
    const aviso = document.getElementById('avisoSolicitacao');

    if (!modalSolicitacao || !botaoAbrir || !botaoFechar ||
        !formulario || !botaoEnviar || !aviso) {

        console.error('Erro: elementos do formulário de solicitação não encontrados.');
        return;
    }

    botaoAbrir.addEventListener('click', (evento) => {
        evento.preventDefault();

        aviso.textContent = '';
        modalSolicitacao.showModal();
    });

    botaoFechar.addEventListener('click', () => {
        modalSolicitacao.close();
    });

    modalSolicitacao.addEventListener('click', (evento) => {

        if (evento.target === modalSolicitacao) {
            modalSolicitacao.close();
        }

    });

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        aviso.textContent = '';

        const dados = Object.fromEntries(
            new FormData(formulario).entries()
        );

        Object.keys(dados).forEach((campo) => {
            dados[campo] = dados[campo].trim();
        });

        if (dados.nome.length < 3) {
            aviso.textContent = 'Informe seu nome completo.';
            return;
        }

        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailValido.test(dados.email)) {
            aviso.textContent = 'Informe um e-mail válido.';
            return;
        }

        if (!dados.perfil) {
            aviso.textContent = 'Selecione um perfil.';
            return;
        }

        if (dados.motivo.length < 10) {
            aviso.textContent = 'Explique melhor o motivo da solicitação.';
            return;
        }

        botaoEnviar.disabled = true;
        botaoEnviar.innerHTML = `
            <i class="bi bi-hourglass-split"></i>
            Enviando...
        `;

        aviso.textContent = 'Enviando solicitação...';

        try {
            if (typeof db === 'undefined') {
                throw new Error('Supabase não inicializado.');
            }

            const { error } = await db
                .from('solicitacoes_acesso')
                .insert({
                    nome: dados.nome,
                    email: dados.email.toLowerCase(),
                    telefone: dados.telefone || null,
                    perfil: dados.perfil,
                    motivo: dados.motivo
                });

            if (error) {
                throw error;
            }
            aviso.textContent =
                'Solicitação enviada com sucesso! Aguarde a aprovação do administrador.';
            aviso.style.color = '#0cc18c';
            formulario.reset();

        } catch (erro) {
            console.error('Erro ao enviar solicitação:', erro);
            aviso.textContent =
                'Erro ao enviar solicitação. Verifique a conexão ou a configuração do Supabase.';
            aviso.style.color = '#ff6679';
        } finally {
            botaoEnviar.disabled = false;
            botaoEnviar.innerHTML = `
                <i class="bi bi-send"></i>
                Enviar solicitação
            `;
        }
    });
});
