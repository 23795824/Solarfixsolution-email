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

// Set Security Headers
app.use(helmet());

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

app.use('/send-email', limiter);

// CORS Configuration - Restrict to Your Domain
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Verify Environment Variables on Startup
console.log('Environment Variables:');
console.log('SMTP_USER:', process.env.SMTP_USER ? '***Exists***' : 'MISSING!');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***Exists***' : 'MISSING!');

// Nodemailer Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify Transporter Connection Configuration
transporter.verify((error) => {
  if (error) {
    console.error('Mail Transporter Error:', error);
  } else {
    console.log('Server is ready to send emails');
  }
});

// Email Sending Endpoint with Validation and Sanitization
app.post(
  '/send-email',
  [
    // Input Validation
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('message').trim().notEmpty().withMessage('Message is required.'),
    body('phone').optional().trim(),
  ],
  async (req, res) => {
    // Handle Validation Errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      // Extract and Sanitize User Inputs
      const name = sanitizeHtml(req.body.name);
      const email = sanitizeHtml(req.body.email);
      const phone = sanitizeHtml(req.body.phone || 'Not provided');
      const message = sanitizeHtml(req.body.message, {
        allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
        allowedAttributes: {},
      });

      console.log('Received sanitized form submission:', { name, email, phone });

      // Compose Mail Options
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: 'info@solarfixsolutions.co.za', // Replace with your desired recipient email
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

      // Send Email
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
  }
);

// Start the Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
