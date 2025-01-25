// Load Environment Variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});

app.use('/send-email', limiter);

let allowedOrigins = [];

if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
} else {
  console.error('ERROR: ALLOWED_ORIGINS environment variable is not set.');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('The CORS policy for this site does not allow access from the specified origin.'), false);
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

console.log('Environment Variables:');
console.log('SMTP_USER:', process.env.SMTP_USER ? '***Exists***' : 'MISSING!');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***Exists***' : 'MISSING!');

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('ERROR: SMTP_USER and SMTP_PASS environment variables are required.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('Mail Transporter Error:', error);
  } else {
    console.log('Server is ready to send emails');
  }
});

app.post('/send-email', [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('Valid email is required.'),
  body('message').trim().notEmpty().withMessage('Message is required.'),
  body('phone').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const name = sanitizeHtml(req.body.name);
    const email = sanitizeHtml(req.body.email);
    const phone = sanitizeHtml(req.body.phone || 'Not provided');
    const message = sanitizeHtml(req.body.message, {
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
      allowedAttributes: {},
    });

    console.log('Received sanitized form submission:', { name, email, phone });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: 'info@solarfixsolutions.co.za',
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h3>New Contact Request</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while sending the email. Please try again later.',
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
