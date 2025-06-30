
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useApiLogsContext } from '@/contexts/ApiLogsContext';

interface WireguardPeer {
  id: string;
  interface: string;
  'public-key': string;
  'allowed-address': string;
  'endpoint-address': string;
  disabled?: boolean;
  comment?: string;
}

interface CreatePeerData {
  interface: string;
  'endpoint-address': string;
}

export const useWireguardPeers = () => {
  const [peers, setPeers] = useState<WireguardPeer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { addLog } = useApiLogsContext();

  // Generate automatic public key (placeholder - normally would be generated properly)
  const generatePublicKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate automatic allowed address from global config
  const generateAllowedAddress = () => {
    // Placeholder - normally would get from global config
    const baseNetwork = '10.0.0';
    const hostId = Math.floor(Math.random() * 254) + 1;
    return `${baseNetwork}.${hostId}/32`;
  };

  const fetchPeers = useCallback(async () => {
    const savedConfig = localStorage.getItem('routerConfig');
    if (!savedConfig) {
      toast({
        title: "Configuração não encontrada",
        description: "Configure a conexão com o roteador primeiro.",
        variant: "destructive"
      });
      return;
    }

    const config = JSON.parse(savedConfig);
    if (config.routerType !== 'mikrotik') {
      console.log('Router type is not Mikrotik, skipping peer fetch');
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();
    const proxyUrl = 'http://localhost:5000/api/router/proxy';

    const requestBody = {
      routerType: config.routerType,
      endpoint: config.endpoint,
      port: config.port,
      user: config.user,
      password: config.password,
      useHttps: config.useHttps,
      path: '/rest/interface/wireguard/peers',
      method: 'GET'
    };

    try {
      console.log('Fetching WireGuard peers from Mikrotik...', requestBody);
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000)
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();
      
      console.log('Peers fetch response:', responseData);

      addLog({
        method: 'GET',
        url: '/rest/interface/wireguard/peers',
        status: response.status,
        requestHeaders: { 'Content-Type': 'application/json' },
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: JSON.stringify(responseData),
        duration
      });

      if (responseData.success && responseData.data) {
        const peersData = Array.isArray(responseData.data) ? responseData.data : [];
        setPeers(peersData);
        console.log('Peers loaded:', peersData);
      } else {
        console.error('Failed to fetch peers:', responseData);
        toast({
          title: "Erro ao carregar peers",
          description: responseData.error || "Falha na comunicação com o roteador",
          variant: "destructive"
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      console.error('Failed to fetch peers:', error);
      
      addLog({
        method: 'GET',
        url: '/rest/interface/wireguard/peers',
        requestHeaders: { 'Content-Type': 'application/json' },
        error: errorMessage,
        duration
      });

      toast({
        title: "Erro de conexão",
        description: "Não foi possível buscar os peers do roteador.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, addLog]);

  const createPeer = useCallback(async (peerData: CreatePeerData) => {
    const savedConfig = localStorage.getItem('routerConfig');
    if (!savedConfig) {
      toast({
        title: "Configuração não encontrada",
        description: "Configure a conexão com o roteador primeiro.",
        variant: "destructive"
      });
      return false;
    }

    const config = JSON.parse(savedConfig);
    if (config.routerType !== 'mikrotik') {
      toast({
        title: "Roteador não suportado",
        description: "Esta funcionalidade é específica para roteadores Mikrotik.",
        variant: "destructive"
      });
      return false;
    }

    setIsCreating(true);
    const startTime = Date.now();
    const proxyUrl = 'http://localhost:5000/api/router/proxy';

    const requestBody = {
      routerType: config.routerType,
      endpoint: config.endpoint,
      port: config.port,
      user: config.user,
      password: config.password,
      useHttps: config.useHttps,
      path: '/rest/interface/wireguard/peers',
      method: 'PUT',
      body: {
        interface: peerData.interface,
        'public-key': generatePublicKey(),
        'allowed-address': generateAllowedAddress(),
        'endpoint-address': peerData['endpoint-address']
      }
    };

    try {
      console.log('Creating WireGuard peer...', requestBody);
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000)
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();
      
      console.log('Peer creation response:', responseData);

      addLog({
        method: 'PUT',
        url: '/rest/interface/wireguard/peers',
        status: response.status,
        requestHeaders: { 'Content-Type': 'application/json' },
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: JSON.stringify(responseData),
        duration
      });

      if (responseData.success) {
        toast({
          title: "✅ Peer criado com sucesso",
          description: "O peer WireGuard foi configurado no roteador.",
        });
        
        // Refresh peers list
        await fetchPeers();
        return true;
      } else {
        toast({
          title: "Erro ao criar peer",
          description: responseData.error || "Falha na comunicação com o roteador",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      console.error('Failed to create peer:', error);
      
      addLog({
        method: 'PUT',
        url: '/rest/interface/wireguard/peers',
        requestHeaders: { 'Content-Type': 'application/json' },
        error: errorMessage,
        duration
      });

      toast({
        title: "Erro de conexão",
        description: "Não foi possível criar o peer no roteador.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [toast, addLog, fetchPeers]);

  useEffect(() => {
    fetchPeers();
  }, [fetchPeers]);

  return {
    peers,
    isLoading,
    isCreating,
    fetchPeers,
    createPeer
  };
};
