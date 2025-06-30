
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  peer: any;
}

const QRCodeModal = ({ isOpen, onClose, peer }: QRCodeModalProps) => {
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [copied, setCopied] = useState(false);

  const generateWireGuardConfig = (peerData: any) => {
    const clientPrivateKey = 'ABCD1234567890ABCD1234567890ABCD1234567890='; // Simulado
    const serverPublicKey = peerData['public-key'] || 'EFGH1234567890EFGH1234567890EFGH1234567890=';
    
    const config = `[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${peerData['allowed-address'] || '10.0.0.10/32'}
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${peerData['endpoint-address'] || 'vpn.stacasa.local'}:${peerData['endpoint-port'] || 51820}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;

    return config;
  };

  const generateQRCode = async (configText: string) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(configText, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      return '';
    }
  };

  useEffect(() => {
    if (isOpen && peer) {
      const config = generateWireGuardConfig(peer);
      setConfigContent(config);
      
      generateQRCode(config).then(qrUrl => {
        setQrCodeUrl(qrUrl);
      });
    }
  }, [isOpen, peer]);

  const downloadConfig = () => {
    const peerName = peer?.name || peer?.['endpoint-address'] || 'peer-config';
    const blob = new Blob([configContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${peerName}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download iniciado",
      description: "Arquivo .conf baixado com sucesso",
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(configContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Copiado!",
      description: "Configuração copiada para a área de transferência",
    });
  };

  const peerName = peer?.name || peer?.['endpoint-address'] || `peer-${peer?.id || peer?.['.id']}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-white">
            <QrCode className="w-5 h-5 mr-2 text-green-400" />
            QR Code - {peerName}
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Escaneie o QR Code para importar a configuração WireGuard
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code WireGuard" 
                  className="w-48 h-48 rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Configuration Preview */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-24">
              {configContent}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button 
              onClick={downloadConfig} 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar
            </Button>
            <Button 
              onClick={copyToClipboard} 
              variant="outline" 
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeModal;
