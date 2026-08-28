// Notifica o(s) admin(s) por push assim que um cliente confirma um
// agendamento. Chamado pelo front-end logo depois de criar o documento em
// "appointments". Se a chave de serviço não estiver configurada, simplesmente
// não faz nada (o agendamento já foi salvo normalmente).

import admin from 'firebase-admin';

function getApp() {
  if (admin.apps.length) return admin.apps[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

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

    const [configSnap, clientSnap] = await Promise.all([
      db.collection('config').doc('geral').get(),
      appt.clientId ? db.collection('clients').doc(appt.clientId).get() : Promise.resolve(null),
    ]);

    const tokens = configSnap.exists ? configSnap.data().adminTokens || [] : [];
    const clientName = clientSnap && clientSnap.exists ? clientSnap.data().name : 'Um cliente';

    let enviados = 0;
    for (const token of tokens) {
      try {
        await admin.messaging(app).send({
          token,
          notification: {
            title: 'Novo agendamento!',
            body: `${clientName} marcou ${appt.date} às ${appt.time}.`,
          },
        });
        enviados++;
      } catch (err) {
        console.error('Falha ao notificar admin:', err.message);
      }
    }

    res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
