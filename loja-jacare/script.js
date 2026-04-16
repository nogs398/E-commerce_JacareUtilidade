const SUPABASE_URL = 'https://ffmtqfjafolydcdaldap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BoUeyott9mr3wpDRS4VP7g_mn7mAQx_';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let produtosLocais = [];
let bannersLocais = [];
let carrinho = [];
let valorFreteAtual = 0;
let bannerAtual = 0;
let modalQuantidadeAtual = 1;
let produtoAtualModal = null;
let freteCalculado = false;

function quantidadeNoCarrinho(produtoId) {
    return carrinho.filter(item => item.id == produtoId).length
}

// --- CARREGAMENTO ---
async function carregarBanners() {
    const { data, error } = await supabaseClient
        .from('banners')
        .select('imagem_url')
        .eq('ativo', true);

    if (!error && data.length > 0) {
        bannersLocais = data.map(b => b.imagem_url);
        renderizarBanner(0);

        setInterval(() => {
            bannerAtual = (bannerAtual + 1) % bannersLocais.length;
            renderizarBanner(bannerAtual);
        }, 5000);
    }
}

function renderizarBanner(i) {
    const img = document.getElementById('banner-img');
    if (img && bannersLocais[i]) {
        img.style.opacity = 0;
        setTimeout(() => {
            img.src = bannersLocais[i];
            img.style.opacity = 1;
        }, 500);
    }
}

function obterCidadeSelecionada() {
    return document.getElementById('input-cidade')?.value.trim() || 'Sete Lagoas';
}

function montarEnderecoCompleto() {
    const rua = document.getElementById('input-endereco')?.value.trim() || '';
    const numero = document.getElementById('input-numero')?.value.trim() || '';
    const bairro = document.getElementById('input-bairro')?.value.trim() || '';
    const complemento = document.getElementById('input-complemento')?.value.trim() || '';
    const cidade = obterCidadeSelecionada();

    let endereco = rua;

    if (numero) endereco += `, ${numero}`;
    if (bairro) endereco += `, ${bairro}`;
    if (complemento) endereco += `, ${complemento}`;
    if (cidade) endereco += `, ${cidade} - MG`;

    return endereco;
}

function marcarFreteComoPendente() {
    freteCalculado = false;
    valorFreteAtual = 0;
    atualizarTotalComFrete();

    const status = document.getElementById('frete-status');
    if (status) {
        status.innerText = 'Frete ainda não calculado.';
        status.style.color = '#666';
    }
}

// --- FRETE ---
async function calcularFrete() {
    const metodoEntrega = document.getElementById('metodo-entrega')?.value;
    const rua = document.getElementById('input-endereco')?.value.trim() || '';
    const numero = document.getElementById('input-numero')?.value.trim() || '';
    const bairro = document.getElementById('input-bairro')?.value.trim() || '';
    const cidade = obterCidadeSelecionada();
    const enderecoCompleto = montarEnderecoCompleto();
    const status = document.getElementById('frete-status');

    if (metodoEntrega !== 'Entrega') {
        valorFreteAtual = 0;
        freteCalculado = false;
        atualizarTotalComFrete();
        return;
    }

    if (!rua) { alert('Informe a rua para calcular o frete.'); return; }
    if (!numero) { alert('Informe o número da casa para calcular o frete.'); return; }
    if (!bairro) { alert('Informe o bairro para calcular o frete.'); return; }
    if (!cidade) { alert('Informe a cidade para calcular o frete.'); return; }

    try {
        const btn = document.getElementById('btn-calcular-frete');
        if (btn) { btn.disabled = true; btn.innerText = 'Calculando...'; }
        if (status) { status.innerText = 'Consultando frete...'; status.style.color = '#666'; }

        const geoResponse = await fetch(`/api/geocode?address=${encodeURIComponent(enderecoCompleto)}`);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok || geoData.lat == null || geoData.lng == null) {
            console.error('Erro ao geocodificar endereço:', geoData);
            valorFreteAtual = 0;
            freteCalculado = false;
            atualizarTotalComFrete();
            if (status) { status.innerText = geoData?.error || 'Não foi possível localizar o endereço.'; status.style.color = '#c62828'; }
            alert(geoData?.error || 'Não foi possível localizar o endereço.');
            return;
        }

        const body = {
            address: enderecoCompleto,
            street: rua,
            number: numero,
            neighborhood: bairro,
            city: cidade,
            state: 'MG',
            country: 'Brasil',
            full_address: enderecoCompleto,
            dropoff_lat: Number(geoData.lat),
            dropoff_lng: Number(geoData.lng)
        };

        const response = await fetch('/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro ao calcular frete:', data);
            valorFreteAtual = 0;
            freteCalculado = false;
            atualizarTotalComFrete();
            if (status) { status.innerText = 'Falha ao calcular frete.'; status.style.color = '#c62828'; }
            alert(data?.error || 'Erro ao calcular o frete.');
            return;
        }

        if (typeof data.shipping === 'number') {
            valorFreteAtual = data.shipping;
            freteCalculado = true;
            atualizarTotalComFrete();
            if (status) {
                status.innerText = `Frete calculado: R$ ${data.shipping.toFixed(2).replace('.', ',')}${data.eta ? ` | ETA: ${data.eta}` : ''}`;
                status.style.color = 'var(--green)';
            }
            alert(`🛵 Frete: R$ ${data.shipping.toFixed(2).replace('.', ',')}${data.eta ? ` | ETA: ${data.eta}` : ''}`);
        } else {
            valorFreteAtual = 0;
            freteCalculado = false;
            atualizarTotalComFrete();
            if (status) { status.innerText = 'Não foi possível calcular o frete.'; status.style.color = '#c62828'; }
            alert('Não foi possível calcular o frete.');
        }
    } catch (error) {
        console.error('Erro na chamada de frete:', error);
        valorFreteAtual = 0;
        freteCalculado = false;
        atualizarTotalComFrete();
        if (status) { status.innerText = 'Erro ao consultar frete.'; status.style.color = '#c62828'; }
        alert('Erro ao consultar o frete.');
    } finally {
        const btn = document.getElementById('btn-calcular-frete');
        if (btn) { btn.disabled = false; btn.innerText = '🛵 Calcular frete'; }
    }
}

function atualizarTotalComFrete() {
    let total = 0;
    carrinho.forEach(item => total += item.preco);

    const totalFinal = total + valorFreteAtual;
    const resumo = document.getElementById('resumo-total-geral');

    if (resumo) {
        resumo.innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
    }
}

async function carregarProdutos() {
    const { data, error } = await supabaseClient.from('produtos').select('*');
    if (error) return console.error('Erro no Supabase:', error);
    produtosLocais = data;
    renderizarGrids(data);
}

// --- VITRINE ---
function renderizarGrids(lista) {
    const itensDisponiveis = lista.filter(p => p.estoque > 0);

    const itensPromocao = itensDisponiveis.filter(p =>
        String(p.em_promocao).toLowerCase() === 'true' || p.em_promocao === 1
    );

    const itensGerais = itensDisponiveis.filter(p =>
        !(String(p.em_promocao).toLowerCase() === 'true' || p.em_promocao === 1)
    );

    renderizarLista(itensPromocao, 'grid-promocoes');
    renderizarLista(itensGerais, 'grid-produtos-geral');
}

function renderizarLista(lista, elementId) {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    grid.innerHTML = '';

    if (lista.length === 0) {
        grid.innerHTML = '<p style="opacity:0.5; padding:20px; width:100%; text-align:center;">Nenhum item encontrado.</p>';
        return;
    }

    lista.forEach(p => {
        const ehPromo = String(p.em_promocao).toLowerCase() === 'true' || p.em_promocao === 1;
        const badgeHtml = ehPromo ? `<span class="promo-badge">PROMOÇÃO</span>` : '';
        const precoAntigoHtml = p.preco_antigo
            ? `<span class="price-old">R$ ${p.preco_antigo.toFixed(2).replace('.', ',')}</span>`
            : '';

        grid.innerHTML += `
            <div class="product-card" onclick="abrirDetalhes(${p.id})">
                ${badgeHtml}
                <div class="product-img-bg">
                    <img src="${p.imagem_url}" onerror="handleImageError(this)">
                </div>
                <h3 style="font-size:0.85rem; margin-bottom:5px;">${p.nome}</h3>
                ${precoAntigoHtml}
                <strong style="color:var(--green)">R$ ${p.preco.toFixed(2).replace('.', ',')}</strong>
            </div>
        `;
    });
}

// --- BUSCA ---
function buscarProdutos() {
    const termo = document.getElementById('input-busca').value.toLowerCase().trim();
    const hero = document.querySelector('.hero');
    const categories = document.querySelector('.categories');
    const btnVoltar = document.getElementById('container-busca-voltar');

    if (!termo) { limparBusca(); return; }

    if (hero) hero.style.display = 'none';
    if (categories) categories.style.display = 'none';
    if (btnVoltar) btnVoltar.style.display = 'block';

    const filtrados = produtosLocais.filter(p => p.nome.toLowerCase().includes(termo));
    renderizarGrids(filtrados);
}

function limparBusca() {
    document.getElementById('input-busca').value = '';
    const hero = document.querySelector('.hero');
    const categories = document.querySelector('.categories');
    const btnVoltar = document.getElementById('container-busca-voltar');

    if (hero) hero.style.display = 'block';
    if (categories) categories.style.display = 'block';
    if (btnVoltar) btnVoltar.style.display = 'none';

    renderizarGrids(produtosLocais);
}

function filtrarPorCategoria(cat) {
    const filtrados = produtosLocais.filter(p => p.categoria === cat);
    renderizarGrids(filtrados);
}

// --- MODAL ---
function abrirDetalhes(id) {
    const p = produtosLocais.find(item => item.id == id);
    if (!p) return;

    produtoAtualModal = p;
    modalQuantidadeAtual = 1;

    document.getElementById('modal-area-venda').style.display = 'block';
    document.getElementById('modal-area-escolha').style.display = 'none';
    document.getElementById('modal-area-checkout').style.display = 'none';
    document.getElementById('modal-footer-preco').style.display = 'flex';
    document.getElementById('modal-btn-acao').style.display = 'block';
    document.getElementById('modal-titulo').innerText = p.nome;

    const imagens = [p.imagem_url, p.imagem_url2, p.imagem_url3].filter(img => img && img !== '');

    let galeriaHtml = `<img src="${imagens[0]}" id="foto-principal-modal" class="main-modal-img">`;

    if (imagens.length > 1) {
        galeriaHtml += `<div class="thumbnails-container">`;
        imagens.forEach(img => {
            galeriaHtml += `<img src="${img}" class="thumb-img" onclick="document.getElementById('foto-principal-modal').src='${img}'">`;
        });
        galeriaHtml += `</div>`;
    }

    document.getElementById('modal-galeria').innerHTML = galeriaHtml;
    document.getElementById('modal-descricao').innerText = p.descricao || 'É um sucesso!';

    atualizarModalUI();

    const btn = document.getElementById('modal-btn-acao');
    btn.innerText = 'Adicionar ao Carrinho';
    btn.onclick = confirmarAdicaoAoCarrinho;

    document.getElementById('modal-produto').style.display = 'block';
}

function atualizarModalUI() {
    document.getElementById('modal-qtd-numero').innerText = modalQuantidadeAtual;

    if (produtoAtualModal) {
        const total = produtoAtualModal.preco * modalQuantidadeAtual;
        let textoPreco = `R$ ${total.toFixed(2).replace('.', ',')}`;

        if (produtoAtualModal.preco_antigo) {
            const totalAntigo = produtoAtualModal.preco_antigo * modalQuantidadeAtual;
            textoPreco = `<span style="font-size:0.9rem; color:#aaa; text-decoration:line-through;">De: R$ ${totalAntigo.toFixed(2).replace('.', ',')}</span><br>Por: R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        document.getElementById('resumo-total-geral').innerHTML = textoPreco;
    }
}

function ajustarQtdModal(delta) {
    const novaQtd = modalQuantidadeAtual + delta;
    if (novaQtd < 1) return;
    if (produtoAtualModal) {
        const jaNoCarrinho = quantidadeNoCarrinho(produtoAtualModal.id);
        const estoqueDisponivel = produtoAtualizado.estoque - jaNoCarrinho;

        if (novaQtd > estoqueDisponivel) {
            alert(`🐊 Opa! Só temos ${Math.max(estoqueDisponivel, 0)} unidades disponíveis para adicionar agora.`);
            return;
        }
    }
    modalQuantidadeAtual = novaQtd;
    atualizarModalUI();
}

// --- CARRINHO ---
function confirmarAdicaoAoCarrinho() {
    const jaNoCarrinho = quantidadeNoCarrinho(produtoAtualModal.id);
    const estoqueDisponivel = produtoAtualModal.estoque - jaNoCarrinho;

    if (modalQuantidadeAtual > estoqueDisponivel) {
        alert(`🐊 Opa! Só temos ${Math.max(estoqueDisponivel, 0)} unidades disponíveis para adicionar agora.`);
        return;
    }

    for (let i = 0; i < modalQuantidadeAtual; i++) {
        carrinho.push({ ...produtoAtualModal, presente: false });
    }
    document.getElementById('cart-count').innerText = carrinho.length;
    document.getElementById('modal-area-venda').style.display = 'none';
    document.getElementById('modal-footer-preco').style.display = 'none';
    document.getElementById('modal-btn-acao').style.display = 'none';
    document.getElementById('modal-area-escolha').style.display = 'block';
}

function abrirCarrinho() {
    if (carrinho.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }

    document.getElementById('modal-area-venda').style.display = 'none';
    document.getElementById('modal-area-escolha').style.display = 'none';
    document.getElementById('modal-area-checkout').style.display = 'block';
    document.getElementById('modal-footer-preco').style.display = 'flex';
    document.getElementById('modal-btn-acao').style.display = 'block';
    document.getElementById('modal-titulo').innerText = '🛒 Seus Pedidos';

    const lista = document.getElementById('modal-lista-carrinho');
    lista.innerHTML = '';

    let total = 0;

    carrinho.forEach((item, index) => {
        total += item.preco;

        lista.innerHTML += `
            <div class="cart-item-row">
                <button class="btn-remover-unitario" onclick="removerDoCarrinho(${index})">🗑️</button>
                <div class="cart-item-info">
                    <strong>${item.nome}</strong>
                    <label style="display:block; font-size:0.75rem; color:var(--green); margin-top:5px; cursor:pointer;">
                        <input type="checkbox" onchange="togglePresente(${index}, this.checked)" ${item.presente ? 'checked' : ''}> 🎁 Presente?
                    </label>
                </div>
                <div class="cart-item-price">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
            </div>
        `;
    });

    const totalFinal = total + valorFreteAtual;
    document.getElementById('resumo-total-geral').innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;

    // ✅ BOTÕES DE AÇÃO: WhatsApp + Mercado Pago
    const btn = document.getElementById('modal-btn-acao');
    btn.innerText = '🚀 Finalizar no WhatsApp';
    btn.onclick = finalizarPedido;

    // Adiciona botão do Mercado Pago se ainda não existir
    let btnMP = document.getElementById('btn-mercado-pago');
    if (!btnMP) {
        btnMP = document.createElement('button');
        btnMP.id = 'btn-mercado-pago';
        btnMP.className = 'add-btn';
        btnMP.style.cssText = 'margin-top: 10px; background: #009ee3; display: flex; align-items: center; justify-content: center; gap: 8px;';
        btnMP.innerHTML = `<img src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.5/mercadopago/logo__large@2x.png" style="height:20px; filter:brightness(0) invert(1);"> Pagar Online`;
        btnMP.onclick = pagarMercadoPago;
        btn.parentNode.insertBefore(btnMP, btn.nextSibling);
    }
    btnMP.style.display = 'block';

    document.getElementById('modal-produto').style.display = 'block';
}

function togglePresente(index, valor) {
    carrinho[index].presente = valor;
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    document.getElementById('cart-count').innerText = carrinho.length;

    if (carrinho.length === 0) fecharModal();
    else abrirCarrinho();
}

// =====================================================================
// ✅ MERCADO PAGO - Cria preferência e redireciona para o checkout
// =====================================================================
async function pagarMercadoPago() {
    const pag = document.getElementById('metodo-pagamento').value;
    const entrega = document.getElementById('metodo-entrega').value;
    const endereco = montarEnderecoCompleto();

    if (entrega === 'Entrega') {
        const rua = document.getElementById('input-endereco')?.value.trim();
        if (!rua) { alert('Informe o endereço para entrega.'); return; }
        if (!freteCalculado) { alert('Por favor, calcule o frete antes de pagar.'); return; }
    }

    if (carrinho.length === 0) { alert('Carrinho vazio!'); return; }

    const btnMP = document.getElementById('btn-mercado-pago');
    if (btnMP) { btnMP.disabled = true; btnMP.innerHTML = '⏳ Gerando link de pagamento...'; }

    try {
        const codPedido = 'JAC-' + Math.floor(1000 + Math.random() * 9000);

        // Monta os itens no formato que o backend espera
        const itensAgrupados = {};
        carrinho.forEach(item => {
            if (!itensAgrupados[item.id]) {
                itensAgrupados[item.id] = { ...item, qtd: 0, presenteQtd: 0 };
            }
            itensAgrupados[item.id].qtd++;
            if (item.presente) itensAgrupados[item.id].presenteQtd++;
        });

        const totalItens = carrinho.reduce((acc, item) => acc + item.preco, 0);
        const totalFinal = totalItens + valorFreteAtual;

        // Chama o backend para criar a preferência
        const response = await fetch('/api/criar-preferencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codPedido,
                itens: Object.values(itensAgrupados),
                frete: valorFreteAtual,
                total: totalFinal,
                entrega,
                endereco: entrega === 'Entrega' ? endereco : 'Retirada na loja',
                pagamento: pag
            })
        });

        const data = await response.json();

        if (!response.ok || !data.init_point) {
            alert(data.error || 'Não foi possível gerar o link de pagamento. Tente novamente.');
            return;
        }

        // Salva o pedido no Supabase como PENDENTE antes de redirecionar
        const tokenConfirmacao = crypto.randomUUID();
        const { error: errPedido } = await supabaseClient.rpc('criar_pedido_com_baixa_estoque', {
            p_code: codPedido,
            p_itens: itensAgrupados,
            p_endereco: entrega === 'Entrega' ? endereco : null,
            p_frete: valorFreteAtual,
            p_total: totalFinal,
            p_status: 'PENDENTE',
            p_token_confirmacao: tokenConfirmacao
        });

        if (errPedido) {
            alert(errPedido.message?.includes('Estoque insuficiente')
                ? 'Um ou mais itens ficaram sem estoque. Atualize e tente novamente.'
                : 'Erro ao registrar pedido.');
            return;
        }

        // Limpa carrinho e redireciona para o Mercado Pago
        carrinho = [];
        valorFreteAtual = 0;
        freteCalculado = false;
        document.getElementById('cart-count').innerText = '0';
        fecharModal();

        // Redireciona para o checkout do Mercado Pago
        window.location.href = data.init_point;

    } catch (err) {
        console.error('Erro ao criar preferência MP:', err);
        alert('Erro ao conectar com o Mercado Pago. Tente novamente.');
    } finally {
        if (btnMP) {
            btnMP.disabled = false;
            btnMP.innerHTML = `<img src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.5/mercadopago/logo__large@2x.png" style="height:20px; filter:brightness(0) invert(1);"> Pagar Online`;
        }
    }
}

// =====================================================================

async function finalizarPedido() {
    const pag = document.getElementById('metodo-pagamento').value;
    const entrega = document.getElementById('metodo-entrega').value;
    const endereco = document.getElementById('input-endereco').value.trim();
    const codPedido = 'JAC-' + Math.floor(1000 + Math.random() * 9000);

    if (entrega === 'Entrega' && !endereco) {
        alert("Informe o endereço para entrega.");
        return;
    }

    const itensAgrupados = {};
    carrinho.forEach(item => {
        if (!itensAgrupados[item.id]) {
            itensAgrupados[item.id] = { ...item, qtd: 0, presenteQtd: 0 };
        }
        itensAgrupados[item.id].qtd++;
        if (item.presente) itensAgrupados[item.id].presenteQtd++;
    });

    let totalGeral = 0;
    for (const i of Object.values(itensAgrupados)) {
        totalGeral += i.preco * i.qtd;

        const produtoAtualizado = produtosLocais.find(produto => produto.id == i.id);
        if (!produtoAtualizado || i.qtd > Number(produtoAtualizado.estoque || 0)) {
            alert(`🐊 Estoque insuficiente para ${i.nome}. Atualize a página e tente novamente.`);
            await carregarProdutos();
            return;
        }
    }

    const totalFinal = totalGeral + valorFreteAtual;
    const tokenConfirmacao = crypto.randomUUID();

    const payloadPedido = {
        p_code: codPedido,
        p_itens: itensAgrupados,
        p_endereco: entrega === 'Entrega' ? endereco : null,
        p_frete: valorFreteAtual,
        p_total: totalFinal,
        p_status: 'PENDENTE',
        p_token_confirmacao: tokenConfirmacao
    };

    const botaoFinalizar = document.getElementById('modal-btn-acao');
    const textoOriginalBotao = botaoFinalizar?.innerText || '🚀 Finalizar no WhatsApp';
    if (botaoFinalizar) {
        botaoFinalizar.disabled = true;
        botaoFinalizar.innerText = 'Salvando pedido...';
    }

    try {
        const { error } = await supabaseClient.rpc('criar_pedido_com_baixa_estoque', payloadPedido);

        if (error) {
            console.error("Erro ao salvar pedido e baixar estoque:", error);
            alert(error.message?.includes('Estoque insuficiente')
                ? 'Um ou mais itens ficaram sem estoque. Atualize a página e tente novamente.'
                : 'Erro ao registrar pedido. Tente novamente.');
            await carregarProdutos();
            return;
        }

        await carregarProdutos();

        let msg = "";
        msg += "🐊 *PEDIDO JACARÉ UTILIDADES*\n";
        msg += "🆔 *CÓDIGO:* " + codPedido + "\n\n";

        Object.values(itensAgrupados).forEach(i => {
            const sub = i.preco * i.qtd;
            let txtPresente = i.presenteQtd > 0 ? ` _(🎁 ${i.presenteQtd} para presente)_` : '';
            msg += `• *(${i.qtd}x)* ${i.nome}${txtPresente} - R$ ${sub.toFixed(2).replace('.', ',')}\n`;
        });

        msg += `\n*TOTAL:* R$ ${totalFinal.toFixed(2).replace('.', ',')}\n`;
        msg += `*PAGAMENTO:* ${pag}\n`;
        msg += `*TIPO:* ${entrega}\n`;

        if (entrega === 'Entrega') {
            msg += `*ENDEREÇO:* ${endereco.toUpperCase()}\n`;
        }

        msg += `\n É um sucesso!\n\n`;

        const msgCodificada = encodeURIComponent(msg);

        carrinho = [];
        valorFreteAtual = 0;
        document.getElementById('cart-count').innerText = '0';
        fecharModal();

        window.open(`https://wa.me/31998997812?text=${msgCodificada}`, '_blank');
    } finally {
        if (botaoFinalizar) {
            botaoFinalizar.disabled = false;
            botaoFinalizar.innerText = textoOriginalBotao;
        }
    }
}

function fecharModal() {
    document.getElementById('modal-produto').style.display = 'none';

    // Esconde o botão MP ao fechar
    const btnMP = document.getElementById('btn-mercado-pago');
    if (btnMP) btnMP.style.display = 'none';
}

function toggleEndereco() {
    const metodo = document.getElementById('metodo-entrega').value;
    const campoEndereco = document.getElementById('campo-endereco');
    const avisoHorario = document.getElementById('aviso-horario');
    const selectPag = document.getElementById('metodo-pagamento');
    const optDinheiro = selectPag.querySelector('option[value="Dinheiro"]');

    if (metodo === 'Entrega') {
        campoEndereco.style.display = 'block';
        if (avisoHorario) avisoHorario.style.display = 'none';
        if (optDinheiro) optDinheiro.style.display = 'none';
        if (selectPag.value === 'Dinheiro') selectPag.value = 'Pix';
        marcarFreteComoPendente();
    } else {
        campoEndereco.style.display = 'none';
        if (avisoHorario) avisoHorario.style.display = 'block';
        if (optDinheiro) optDinheiro.style.display = 'block';
        valorFreteAtual = 0;
        freteCalculado = false;
        atualizarTotalComFrete();
    }
}

function compartilharProduto() {
    if (!produtoAtualModal) return;

    const texto = `🐊 Olhe o que achei na Jacaré Utilidades!\n\n*${produtoAtualModal.nome}*\nPreço: R$ ${produtoAtualModal.preco.toFixed(2).replace('.', ',')}\n\nConfira: ${window.location.href}`;

    if (navigator.share) {
        navigator.share({
            title: 'Jacaré Utilidades',
            text: texto,
            url: window.location.href
        }).catch(console.error);
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    }
}

function configurarEventosFrete() {
    const inputEndereco = document.getElementById('input-endereco');
    const inputNumero = document.getElementById('input-numero');
    const inputBairro = document.getElementById('input-bairro');
    const inputComplemento = document.getElementById('input-complemento');
    const inputCidade = document.getElementById('input-cidade');
    const metodoEntrega = document.getElementById('metodo-entrega');
    const btnCalcularFrete = document.getElementById('btn-calcular-frete');

    if (inputEndereco) inputEndereco.addEventListener('input', marcarFreteComoPendente);
    if (inputNumero) inputNumero.addEventListener('input', marcarFreteComoPendente);
    if (inputBairro) inputBairro.addEventListener('input', marcarFreteComoPendente);
    if (inputComplemento) inputComplemento.addEventListener('input', marcarFreteComoPendente);
    if (inputCidade) inputCidade.addEventListener('change', marcarFreteComoPendente);

    if (metodoEntrega) metodoEntrega.addEventListener('change', toggleEndereco);
    if (btnCalcularFrete) btnCalcularFrete.addEventListener('click', calcularFrete);
}

carregarProdutos();
carregarBanners();

document.addEventListener('DOMContentLoaded', () => {
    configurarEventosFrete();
});
