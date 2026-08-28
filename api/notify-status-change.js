// Notifica o cliente por push quando o admin confirma o agendamento ou marca
// o carro como pronto. Chamado pelo front-end logo depois de atualizar o
// status em "appointments". Se a chave de serviço não estiver configurada,
// simplesmente não faz nada (o status já foi salvo normalmente).

import admin from 'firebase-admin';

function getApp() {
  if (admin.apps.length) return admin.apps[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const MESSAGES = {
  confirmado: 'Seu agendamento foi confirmado!',
  pronto: 'Seu carro esta pronto! Pode vir buscar.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const app = getApp();
    if (!app) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const db = admin.firestore(app);
    const { appointmentId } = req.body || {};
    if (!appointmentId) {
      res.status(400).json({ error: 'appointmentId é obrigatório' });
      return;
    }

    const apptSnap = await db.collection('appointments').doc(appointmentId).get();
    if (!apptSnap.exists) {
      res.status(404).json({ error: 'Agendamento não encontrado' });
      return;
    }
    const appt = apptSnap.data();

    const body = MESSAGES[appt.status];
    if (!body || !appt.clientId) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const clientSnap = await db.collection('clients').doc(appt.clientId).get();
    const tokens = clientSnap.exists ? clientSnap.data().pushTokens || [] : [];

    let enviados = 0;
    for (const token of tokens) {
      try {
        await admin.messaging(app).send({
          token,
          notification: { title: 'Brilho Total', body },
        });
        enviados++;
      } catch (err) {
        console.error('Falha ao notificar cliente:', err.message);
      }
    }

    res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
