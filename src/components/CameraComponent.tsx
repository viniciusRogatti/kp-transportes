import React, { useRef } from 'react';
import { Camera } from "react-camera-pro";

const CameraComponent: React.FC = () => {
  const cameraRef = useRef<any>(null);

  const takePicture = () => {
    if (cameraRef.current) {
      // Verifique se a biblioteca utilizada possui um método adequado para capturar a imagem
      if (cameraRef.current.capture) {
        const image = cameraRef.current.capture();
        // Faça algo com a imagem capturada, como exibi-la em um elemento <img>
      } else if (cameraRef.current.getScreenshot) {
        const image = cameraRef.current.getScreenshot();
        // Faça algo com a imagem capturada, como exibi-la em um elemento <img>
      } else {
        console.error('Método de captura não encontrado na biblioteca utilizada.');
      }
    }
  };

  return (
    <div>
      <Camera ref={cameraRef} errorMessages={{ /* Aqui você pode definir mensagens de erro personalizadas, se necessário */ }} />
      <button onClick={takePicture}>Tirar Foto</button>
    </div>
  );
};

export default CameraComponent;
