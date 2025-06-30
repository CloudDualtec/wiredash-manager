
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Network, Plus, Edit, Trash2, Power, PowerOff, Activity, Clock, CheckCircle } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import WireGuardInterfaceModal from '../components/WireGuardInterfaceModal';
import { useToast } from '@/hooks/use-toast';

interface WireGuardInterface {
  '.id': string;
  'disabled': string;
  'listen-port': string;
  'mtu': string;
  'name': string;
  'private-key': string;
  'public-key': string;
  'running': string;
}

const Interfaces = () => {
  const [interfaces, setInterfaces] = useState<WireGuardInterface[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInterfaces = async () => {
    try {
      const savedConfig = localStorage.getItem('routerConfig');
      if (!savedConfig) {
        toast({
          title: "Configuração não encontrada",
          description: "Configure a conexão com o roteador nas Configurações primeiro.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const config = JSON.parse(savedConfig);
      
      if (!config.endpoint || !config.user || !config.password) {
        toast({
          title: "Configuração incompleta",
          description: "Verifique as configurações de conexão com o roteador.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const proxyUrl = 'http://localhost:5000/api/router/proxy';
      
      const requestBody = {
        routerType: config.routerType || 'mikrotik',
        endpoint: config.endpoint,
        port: config.port,
        user: config.user,
        password: config.password,
        useHttps: config.useHttps,
        path: '/rest/interface/wireguard',
        method: 'GET'
      };

      console.log('Fetching WireGuard interfaces...', requestBody);

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000)
      });

      const responseData = await response.json();
      console.log('WireGuard interfaces response:', responseData);

      if (responseData.success && responseData.status === 200) {
        const interfacesData = Array.isArray(responseData.data) ? responseData.data : [];
        setInterfaces(interfacesData);
        
        if (interfacesData.length === 0) {
          toast({
            title: "Nenhuma interface encontrada",
            description: "Não foram encontradas interfaces WireGuard configuradas.",
          });
        }
      } else {
        toast({
          title: "Erro ao buscar interfaces",
          description: responseData.error || "Falha ao conectar com o roteador.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching interfaces:', error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao backend. Verifique se o serviço está executando.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInterface = async (interfaceId: string, interfaceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a interface ${interfaceName}?`)) {
      return;
    }

    setDeletingId(interfaceId);

    try {
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
      const proxyUrl = 'http://localhost:5000/api/router/proxy';
      
      const requestBody = {
        routerType: config.routerType || 'mikrotik',
        endpoint: config.endpoint,
        port: config.port,
        user: config.user,
        password: config.password,
        useHttps: config.useHttps,
        path: `/rest/interface/wireguard/${interfaceId}`,
        method: 'DELETE'
      };

      console.log('Deleting WireGuard interface...', requestBody);

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000)
      });

      const responseData = await response.json();
      console.log('Delete interface response:', responseData);

      if (responseData.success && (responseData.status === 200 || responseData.status === 204)) {
        toast({
          title: "Interface deletada",
          description: `Interface ${interfaceName} foi deletada com sucesso.`,
        });
        fetchInterfaces(); // Refresh the list
      } else {
        toast({
          title: "Erro ao deletar interface",
          description: responseData.error || "Falha ao deletar a interface.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting interface:', error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao backend.",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchInterfaces();
  }, []);

  const totalInterfaces = interfaces.length;
  const activeInterfaces = interfaces.filter(iface => iface.running === 'true').length;
  const enabledInterfaces = interfaces.filter(iface => iface.disabled === 'false').length;

  const stats = [
    {
      title: 'Total de Interfaces',
      value: totalInterfaces,
      subtitle: 'Interfaces configuradas',
      icon: Network,
      gradient: 'from-blue-600 to-blue-700'
    },
    {
      title: 'Interfaces Ativas',
      value: activeInterfaces,
      subtitle: 'Em funcionamento',
      icon: CheckCircle,
      trend: activeInterfaces > 0 ? { value: 15, isPositive: true } : undefined,
      gradient: 'from-green-600 to-green-700'
    },
    {
      title: 'Interfaces Habilitadas',
      value: enabledInterfaces,
      subtitle: 'Prontas para uso',
      icon: Clock,
      gradient: 'from-purple-600 to-purple-700'
    }
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-white">Carregando interfaces...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Gerenciar Interfaces</h1>
            <p className="text-gray-400 text-lg">Visualize e gerencie todas as interfaces WireGuard</p>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Interface
          </Button>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
              trend={stat.trend}
              gradient={stat.gradient}
            />
          ))}
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Network className="w-5 h-5 mr-2" />
              Lista de Interfaces WireGuard
            </CardTitle>
            <CardDescription>
              {interfaces.length > 0 
                ? `${interfaces.length} interface(s) WireGuard encontrada(s)`
                : 'Nenhuma interface WireGuard configurada'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interfaces.length === 0 ? (
              <div className="text-center py-8">
                <Network className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">Nenhuma interface WireGuard encontrada</p>
                <p className="text-sm text-gray-500">Configure interfaces WireGuard no seu roteador para vê-las aqui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {interfaces.map((iface) => {
                  const isRunning = iface.running === 'true';
                  const isEnabled = iface.disabled === 'false';
                  const isDeleting = deletingId === iface['.id'];
                  
                  return (
                    <div key={iface['.id']} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-800/70 transition-colors">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex items-center space-x-2">
                          {isRunning ? (
                            <div className="flex items-center text-green-400">
                              <Activity className="w-4 h-4" />
                              <span className="text-xs ml-1 font-medium">Ativo</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-red-400">
                              <Activity className="w-4 h-4" />
                              <span className="text-xs ml-1 font-medium">Inativo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div>
                              <h3 className="font-semibold text-white">{iface.name}</h3>
                              <p className="text-sm text-gray-400">
                                Porta: {iface['listen-port']} • MTU: {iface.mtu}
                                {!isEnabled && ' • Desabilitada'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">ID: {iface['.id']}</p>
                              <p className="text-xs text-gray-500">
                                Status: {isEnabled ? 'Habilitada' : 'Desabilitada'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 h-8 w-8 p-0">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isEnabled ? (
                          <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300 hover:bg-orange-600/20 h-8 w-8 p-0">
                            <PowerOff className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 hover:bg-green-600/20 h-8 w-8 p-0">
                            <Power className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-400 hover:text-red-300 hover:bg-red-600/20 h-8 w-8 p-0"
                          onClick={() => handleDeleteInterface(iface['.id'], iface.name)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <WireGuardInterfaceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchInterfaces}
        />
      </div>
    </Layout>
  );
};

export default Interfaces;
