require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Em produção a aplicação roda atrás do proxy da hospedagem. Sem isto,
// todas as requisições chegam com o mesmo IP e o rate limit passa a
// contar todos os visitantes como um só.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Cabeçalhos de segurança. A CSP libera o Google Fonts, único host
// externo que a página usa.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// O front-end é servido pelo mesmo servidor, então a API não precisa
// aceitar chamadas de outras origens. ALLOWED_ORIGIN permite liberar
// um domínio específico caso o front passe a ser hospedado à parte.
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || false
}));

app.use(express.json({ limit: '10kb' }));

// serve o front-end estático
app.use(express.static(path.join(__dirname, '../frontend')));

// limite de envio: 5 mensagens por IP a cada 15 minutos
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas mensagens em pouco tempo. Tente novamente em alguns minutos.' }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'portfolio-backend' });
});

/**
 * POST /api/contact
 * Recebe { nome, email, mensagem } e encaminha por e-mail.
 */
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { nome, email, mensagem, website } = req.body || {};

  // honeypot: campo invisível no formulário. Se veio preenchido, é bot.
  if (website) {
    return res.status(200).json({ message: 'Mensagem enviada com sucesso.' });
  }

  // validação
  const erros = [];
  if (!nome || nome.trim().length < 2) erros.push('Informe seu nome.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push('Informe um e-mail válido.');
  if (!mensagem || mensagem.trim().length < 10) erros.push('A mensagem precisa ter ao menos 10 caracteres.');

  if (erros.length) {
    return res.status(400).json({ error: erros.join(' ') });
  }

  const limpo = (s) => String(s).trim().slice(0, 5000);
  const destino = process.env.EMAIL_TO || process.env.EMAIL_USER;

  const assunto = `Contato pelo portfólio — ${limpo(nome)}`;
  const corpo = `Nome: ${limpo(nome)}\nE-mail: ${limpo(email)}\n\nMensagem:\n${limpo(mensagem)}`;
  const respondePara = `${limpo(nome)} <${limpo(email)}>`;

  try {
    if (process.env.RESEND_API_KEY) {
      await enviarViaResend({ destino, assunto, corpo, respondePara });
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await enviarViaSmtp({ destino, assunto, corpo, respondePara });
    } else {
      console.error('Nenhum método de envio configurado (RESEND_API_KEY ou EMAIL_USER/EMAIL_PASS).');
      return res.status(500).json({ error: 'Serviço de e-mail indisponível no momento.' });
    }

    res.status(200).json({ message: 'Mensagem enviada com sucesso.' });
  } catch (err) {
    console.error('Falha ao enviar e-mail:', err.message);
    res.status(500).json({ error: 'Não foi possível enviar agora. Tente novamente ou use o e-mail direto.' });
  }
});

/**
 * Envio via API HTTP do Resend.
 * Usado em produção: hospedagens gratuitas costumam bloquear as portas
 * de SMTP (25, 465, 587), e uma chamada HTTPS comum não esbarra nisso.
 */
async function enviarViaResend({ destino, assunto, corpo, respondePara }) {
  const remetente = process.env.RESEND_FROM || 'Portfólio <onboarding@resend.dev>';

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: remetente,
      to: [destino],
      reply_to: respondePara,
      subject: assunto,
      text: corpo
    })
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Resend respondeu ${resposta.status}: ${detalhe}`);
  }
}

/**
 * Envio via SMTP do Gmail. Mantido para desenvolvimento local, onde
 * as portas de SMTP estão liberadas.
 */
async function enviarViaSmtp({ destino, assunto, corpo, respondePara }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"Portfólio — contato" <${process.env.EMAIL_USER}>`,
    to: destino,
    replyTo: respondePara,
    subject: assunto,
    text: corpo
  });
}

// qualquer outra rota devolve o front-end
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
