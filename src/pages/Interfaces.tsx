import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Network, Plus, Edit, Trash2, Power, PowerOff, Activity, Clock, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import WireGuardInterfaceModal from '../components/WireGuardInterfaceModal';
import WireGuardEditModal from '../components/WireGuardEditModal';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInterface, setEditingInterface] = useState<WireGuardInterface | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [connectionValid, setConnectionValid] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [routerConfig, setRouterConfig] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check router connection validity using the same API that saves configs
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('Loading router configuration from SQLite API...');
        const configResponse = await apiService.getRouterConfig();
        
        if (!configResponse.success || !configResponse.data) {
          console.log('No router configuration found in SQLite database');
          setConnectionValid(false);
          setIsCheckingConnection(false);
          return;
        }

        const config = configResponse.data;
        console.log('Router configuration loaded:', config);
        setRouterConfig(config);

        if (!config.endpoint || !config.user || !config.password) {
          console.log('Router configuration incomplete');
          setConnectionValid(false);
          setIsCheckingConnection(false);
          return;
        }

        // Test the connection using the same API endpoint
        const response = await fetch('http://localhost:5000/api/router/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            routerType: config.router_type,
            endpoint: config.endpoint,
            port: config.port,
            user: config.user,
            password: config.password,
            useHttps: config.use_https
          }),
          signal: AbortSignal.timeout(10000)
        });

        const responseData = await response.json();
        
        if (responseData.success && responseData.status === 200) {
          setConnectionValid(true);
        } else {
          setConnectionValid(false);
        }
      } catch (error) {
        console.error('Connection test failed:', error);
        setConnectionValid(false);
      } finally {
        setIsCheckingConnection(false);
      }
    };

    checkConnection();
  }, []);

  // Fetch interfaces when connection is valid and router config is loaded
  useEffect(() => {
    if (connectionValid === true && routerConfig) {
      console.log('Connection valid, fetching interfaces...');
      fetchInterfaces();
    } else if (connectionValid === false) {
      setIsLoading(false);
    }
  }, [connectionValid, routerConfig]);

  // Make API request through backend proxy
  const makeProxyRequest = async (path: string, method: string = 'GET', body?: any) => {
    if (!routerConfig) {
      throw new Error('Router configuration not found');
    }
    
    const requestBody = {
      routerType: routerConfig.router_type || 'mikrotik',
      endpoint: routerConfig.endpoint,
      port: routerConfig.port,
      user: routerConfig.user,
      password: routerConfig.password,
      useHttps: routerConfig.use_https,
      path: path,
      method: method,
      ...(body && { body })
    };

    const response = await fetch('http://localhost:5000/api/router/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000)
    });

    return response;
  };

  const fetchInterfaces = async () => {
    try {
      console.log('Fetching WireGuard interfaces via backend proxy...');

      const response = await makeProxyRequest('/rest/interface/wireguard', 'GET');
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
        setConnectionValid(false);
      }
    } catch (error) {
      console.error('Error fetching interfaces:', error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao backend. Verifique se o serviço está executando.",
        variant: "destructive"
      });
      setConnectionValid(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleInterface = async (interfaceId: string, interfaceName: string, currentDisabled: string) => {
    const willDisable = currentDisabled === 'false';
    const action = willDisable ? 'desabilitar' : 'habilitar';
    
    if (!confirm(`Tem certeza que deseja ${action} a interface ${interfaceName}?`)) {
      return;
    }

    setTogglingId(interfaceId);

    try {
      console.log('Toggling WireGuard interface via backend proxy...');

      const response = await makeProxyRequest(`/rest/interface/wireguard/${interfaceId}`, 'PATCH', {
        disabled: willDisable
      });

      const responseData = await response.json();
      console.log('Toggle interface response:', responseData);

      if (responseData.success) {
        toast({
          title: `Interface ${willDisable ? 'desabilitada' : 'habilitada'}`,
          description: `Interface ${interfaceName} foi ${willDisable ? 'desabilitada' : 'habilitada'} com sucesso.`,
        });
        await fetchInterfaces();
      } else {
        toast({
          title: `Erro ao ${action} interface`,
          description: responseData.error || `Falha ao ${action} a interface.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error toggling interface:', error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao backend.",
        variant: "destructive"
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteInterface = async (interfaceId: string, interfaceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a interface ${interfaceName}?`)) {
      return;
    }

    setDeletingId(interfaceId);

    try {
      console.log('Deleting WireGuard interface via backend proxy...');

      const response = await makeProxyRequest(`/rest/interface/wireguard/${interfaceId}`, 'DELETE');
      const responseData = await response.json();
      
      console.log('Delete interface response:', responseData);

      if (responseData.success) {
        toast({
          title: "Interface deletada",
          description: `Interface ${interfaceName} foi deletada com sucesso.`,
        });
        await fetchInterfaces();
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

  const handleEditInterface = (iface: WireGuardInterface) => {
    setEditingInterface(iface);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = async () => {
    setIsEditModalOpen(false);
    setEditingInterface(null);
    await fetchInterfaces();
  };

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

  if (isCheckingConnection) {
    return (
      <Layout>
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-white">Verificando conexão com o roteador...</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (connectionValid === false) {
    return (
      <Layout>
        <div className="space-y-8 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Gerenciar Interfaces</h1>
            <p className="text-gray-400 text-lg">Visualize e gerencie todas as interfaces WireGuard</p>
          </div>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-8">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Erro de Conexão</h2>
                <p className="text-gray-400 mb-6">
                  Não foi possível conectar ao roteador. Verifique as configurações de conexão.
                </p>
                <Button 
                  onClick={() => navigate('/settings')}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ir para Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Gerenciar Interfaces</h1>
          <p className="text-gray-400 text-lg">Visualize e gerencie todas as interfaces WireGuard</p>
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
            <div className="flex items-center justify-between">
              <div>
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
              </div>
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Interface
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-white">Carregando interfaces...</div>
              </div>
            ) : interfaces.length === 0 ? (
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
                  const isToggling = togglingId === iface['.id'];
                  
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 h-8 w-8 p-0"
                          onClick={() => handleEditInterface(iface)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`h-8 w-8 p-0 ${isEnabled ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-600/20' : 'text-green-400 hover:text-green-300 hover:bg-green-600/20'}`}
                          onClick={() => handleToggleInterface(iface['.id'], iface.name, iface.disabled)}
                          disabled={isToggling}
                        >
                          {isEnabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </Button>
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

        <WireGuardEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
          interface={editingInterface}
        />
      </div>
    </Layout>
  );
};

export default Interfaces;
