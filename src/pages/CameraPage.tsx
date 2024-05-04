import { useState } from 'react';
import CameraComponent from '../components/CameraComponent';

const CameraPage = () => {
  const [photo, setPhoto] = useState('');
  const [nf, setNf] = useState('');
  const [status, setStatus] = useState('');
  const [describe, setDescribe] = useState('');

  const takePhoto = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const mediaRecorder = new MediaRecorder(mediaStream);

      mediaRecorder.ondataavailable = (e) => {
        const blob = new Blob([e.data], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);
        setPhoto(imageUrl);
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
        mediaStream.getTracks().forEach(track => track.stop());
      }, 3000); // Stop recording after 3 seconds (adjust as needed)
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    // Aqui você pode enviar os dados (nf, type, describe) para o backend
    console.log('Nota:', nf);
    console.log('Tipo:', status);
    console.log('Observação:', describe);
    // Também pode enviar a foto (photo) para o backend
    console.log('Foto:', photo);
    // Reiniciar o estado após o envio bem-sucedido
    setNf('');
    setStatus('');
    setDescribe('');
    setPhoto('');
  };

  return (
    <div>
      <h1>Tirar Foto</h1>
      <CameraComponent />
      {/* <button onClick={takePhoto}>Tirar Foto</button> */}
      {photo && <img src={photo} alt="Foto tirada" />}
      <form onSubmit={handleSubmit}>
        <label>
          Número da Nota:
          <input type="text" value={nf} onChange={(e) => setNf(e.target.value)} />
        </label>
        <label>
          Tipo:
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Selecione o type</option>
            <option value="entrega_realizada">Entrega Realizada</option>
            <option value="devolucao">Devolução</option>
            <option value="parcial">Parcial</option>
            <option value="quebra_de_peso">Quebra de Peso</option>
            <option value="re_entrega">Re-Entrega</option>
          </select>
        </label>
        {status !== 'entrega_realizada' && (
          <label>
            Observação:
            <input type="text" value={describe} onChange={(e) => setDescribe(e.target.value)} />
          </label>
        )}
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
};

export default CameraPage;
