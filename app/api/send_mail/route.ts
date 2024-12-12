import nodemailer from 'nodemailer';

const sendMail = process.env.NEXT_PUBLIC_SEND_MAIL==="true";

export async function POST(req: Request) {
    const { to, cc, replyTo, subject, text,  } = await req.json();
    console.log("to : ", to);
    console.log("subject : ", subject);
    console.log("text : ", text);
    console.log("cc : ", cc);
    console.log("replyTo : ", replyTo);
    console.log("Envoyé ? ", sendMail);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Exemple avec Gmail
    port: 587,
    secure: false,
    auth: {
      user: 'contact.prestataire.fleap@gmail.com',
      pass: process.env.NEXT_PUBLIC_PASSWORD_GMAIL_SMTP, // Utilise un mot de passe spécifique à l'application
    },
  });

  const mailOptions = {
    from: 'arthur.pouzargue@gmail.com',
    to: to,
    replyTo: replyTo, // Redirige les réponses vers le mail de l'utilisateur
    cc: cc,
    subject: subject,
    text: text,
  };

  if(sendMail){
    try {
      const info = await transporter.sendMail(mailOptions);
      return new Response(JSON.stringify({ message: 'Email sent', info }), { status: 200 });
    } catch (error: unknown) {
      if (error instanceof Error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }
  }
  return new Response(JSON.stringify({ error: 'Unknown error' }), { status: 500 });
}
