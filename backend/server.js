require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('EMAIL_USER ou EMAIL_PASS ausentes no ambiente.');
    return res.status(500).json({ error: 'Serviço de e-mail indisponível no momento.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const limpo = (s) => String(s).trim().slice(0, 5000);

  try {
    await transporter.sendMail({
      from: `"Portfólio — contato" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      replyTo: `${limpo(nome)} <${limpo(email)}>`,
      subject: `Contato pelo portfólio — ${limpo(nome)}`,
      text: `Nome: ${limpo(nome)}\nE-mail: ${limpo(email)}\n\nMensagem:\n${limpo(mensagem)}`
    });

    res.status(200).json({ message: 'Mensagem enviada com sucesso.' });
  } catch (err) {
    console.error('Falha ao enviar e-mail:', err.message);
    res.status(500).json({ error: 'Não foi possível enviar agora. Tente novamente ou use o e-mail direto.' });
  }
});

// qualquer outra rota devolve o front-end
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
