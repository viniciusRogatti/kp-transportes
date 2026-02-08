import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../data';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import { useNavigate } from 'react-router';
import { BoxInput, BoxMessage, HiddenFileInput, FileUploadLabel, UploadButton } from '../style/FileUploadPage';
import { IUploadResponse } from '../types/types';
import { Loading } from '../style/Loaders';

const FileUploadPage: React.FC = () => {
  const [fileCountMessage, setFileCountMessage] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]); // Novo estado para armazenar as mensagens de log
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchToken = async () => {
      if (token) {
        const isValidToken = await verifyToken(token);
        if (!isValidToken) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };
    fetchToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setLogMessages([]);
      const files = event.target.files;
      const xmlFiles = Array.from(files).filter(file => file.name.endsWith('.xml'));
      setSelectedFiles(xmlFiles);
      setFileCountMessage(`${xmlFiles.length} arquivo(s) selecionado(s).`);
    } else {
      setFileCountMessage('');
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length > 0 && !uploading) {
      setUploading(true);

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      try {
        const response = await axios.post<IUploadResponse>(`${API_URL}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        console.log('Arquivos enviados com sucesso!');
        setLogMessages(response.data.details.map(detail => detail.message));
        const successMessage = response.data.details[0].message;
        if (successMessage.includes('XMLs processadas com sucesso!')) {
          setFileCountMessage(successMessage);
        } else {
          setFileCountMessage('Nenhum arquivo foi salvo');
        }

      } catch (error) {
        console.error('Erro ao enviar arquivos:', error);
      } finally {
        setUploading(false);

        // Agora, configuramos um timeout de 1 segundo antes de permitir a próxima solicitação
        setTimeout(() => {
          // O timeout expirou, permitindo a próxima solicitação
        }, 100);
      }
    } else {
      console.error('Nenhum arquivo .xml selecionado ou upload em andamento.');
    }
  };

  return (
    <div>
      <Header />
      <Container>
        {uploading ? (
          <Loading />
        ) : (
          <>
            <BoxInput>
              <HiddenFileInput type="file" id="fileInput" onChange={handleFileChange} multiple accept=".xml" />
              <FileUploadLabel htmlFor="fileInput">Escolha um arquivo</FileUploadLabel>
              <UploadButton onClick={handleUpload} disabled={uploading}>
                Enviar Arquivos .xml
              </UploadButton>
            </BoxInput>
            <BoxMessage>
              <h4>{fileCountMessage}</h4>
              <div>
                {logMessages.map((msg, index) => (
                  <p key={index}>{msg}</p>
                ))}
              </div>  
            </BoxMessage>
          </>
        )}
      </Container>
    </div>
  );  
};

export default FileUploadPage;
