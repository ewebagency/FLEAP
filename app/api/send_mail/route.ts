import nodemailer from 'nodemailer';

const sendMail = process.env.NEXT_PUBLIC_SEND_MAIL==="true";

interface Attachment {
    filename: string;
    content: string;
    contentType: string;
}

export async function POST(req: Request) {
    const { to, cc, replyTo, subject, text, attachments } = await req.json();
    console.log("to : ", to);
    console.log("subject : ", subject);
    console.log("text : ", text);
    console.log("cc : ", cc);
    console.log("replyTo : ", replyTo);
    console.log("attachments : ", attachments);
    console.log("Envoyé ? ", sendMail);

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'contact.prestataire.fleap@gmail.com',
            pass: process.env.NEXT_PUBLIC_PASSWORD_GMAIL_SMTP,
        }
    } as nodemailer.TransportOptions);

    const mailOptions = {
        from: 'arthur.pouzargue@gmail.com',
        to: to,
        replyTo: replyTo,
        cc: cc,
        subject: subject,
        text: text,
        encoding: 'base64',
        attachments: attachments ? (attachments as Attachment[]).map(attachment => ({
            filename: attachment.filename,
            content: Buffer.from(attachment.content, 'base64'),
            contentType: attachment.contentType
        })) : []
    };

    if(sendMail){
        try {
            const info = await transporter.sendMail(mailOptions);
            return new Response(JSON.stringify({ message: 'Email sent', info }), { status: 200 });
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error('Erreur d\'envoi d\'email:', error);
                return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }
        }
    }
    return new Response(JSON.stringify({ error: 'Unknown error' }), { status: 500 });
}
