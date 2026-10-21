import React, { useState } from 'react';
import { Shield, FileText, ArrowLeft } from 'lucide-react';
import { APP_NAME } from '../lib/constants';

interface LegalPageProps {
  onBack: () => void;
  defaultSection?: 'terms' | 'privacy';
}

export const LegalPage: React.FC<LegalPageProps> = ({ onBack, defaultSection = 'terms' }) => {
  const [section, setSection] = useState<'terms' | 'privacy'>(defaultSection);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto text-[#F5F5F5]">
      {/* Top back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs font-semibold text-[#A3A3A3] hover:text-[#F5F5F5] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao Aplicativo</span>
      </button>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-[#141414] border border-[#2B2B2B] rounded-2xl w-full sm:w-80">
        <button
          onClick={() => setSection('terms')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            section === 'terms' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Termos de Uso
        </button>
        <button
          onClick={() => setSection('privacy')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            section === 'privacy' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Política de Privacidade
        </button>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-8 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-6 text-xs sm:text-sm text-[#A3A3A3] leading-relaxed">
        {section === 'terms' ? (
          <>
            <div className="flex items-center gap-2 pb-3 border-b border-[#2B2B2B]">
              <FileText className="w-5 h-5 text-[#D97757]" />
              <h2 className="text-lg font-bold text-[#F5F5F5]">Termos e Condições de Uso - {APP_NAME}</h2>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#F5F5F5]">1. Aceitação dos Termos</h3>
              <p>
                Ao criar uma conta ou utilizar o aplicativo {APP_NAME}, você declara ter lido, compreendido e concordado expressamente com estes Termos de Uso e com nossa Política de Privacidade.
              </p>

              <h3 className="font-bold text-sm text-[#F5F5F5]">2. Descrição do Serviço</h3>
              <p>
                O {APP_NAME} é uma ferramenta digital voltada à organização, acompanhamento e planejamento financeiro pessoal e familiar. O aplicativo oferece funcionalidades como registro de receitas e despesas, controle de contas e cartões de crédito, definição de orçamentos e metas, e importação/exportação de dados.
              </p>

              <h3 className="font-bold text-sm text-[#F5F5F5]">3. Responsabilidade do Usuário</h3>
              <p>
                O usuário é o único responsável pela veracidade e exatidão dos dados inseridos, bem como pela confidencialidade de sua senha e código PIN de acesso local. O {APP_NAME} não presta serviços de consultoria financeira regulamentada ou assessoria contábil.
              </p>

              <h3 className="font-bold text-sm text-[#F5F5F5]">4. Compartilhamento de Workspaces</h3>
              <p>
                Ao gerar e fornecer códigos de convite para membros (editores ou visualizadores), você autoriza os respectivos usuários a visualizarem e/ou editarem os registros financeiros contidos naquele espaço de trabalho específico.
              </p>

              <h3 className="font-bold text-sm text-[#F5F5F5]">5. Rescisão e Exclusão</h3>
              <p>
                Você poderá a qualquer momento solicitar a exportação integral dos seus dados ou a exclusão irreversível de sua conta diretamente nas opções de Configurações do aplicativo.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 pb-3 border-b border-[#2B2B2B]">
              <Shield className="w-5 h-5 text-[#D97757]" />
              <h2 className="text-lg font-bold text-[#F5F5F5]">Política de Privacidade e LGPD - {APP_NAME}</h2>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#F5F5F5]">1. Dados Coletados e Finalidade</h3>
              <p>
                Coletamos apenas as informações estritamente necessárias para o funcionamento do serviço:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-[#F5F5F5]">Dados de Cadastro:</strong> Nome, endereço de e-mail e foto de perfil opcional, para autenticação e identificação de autoria nos workspaces.</li>
                <li><strong className="text-[#F5F5F5]">Dados Financeiros:</strong> Registros de transações, contas bancárias cadastradas, faturas de cartão e orçamentos inseridos pelo próprio usuário.</li>
                <li><strong className="text-[#F5F5F5]">Dados de Segurança:</strong> O PIN de bloqueio do aplicativo é processado exclusivamente no seu dispositivo, sendo armazenado apenas como hash criptográfico saltado com PBKDF2 via Web Crypto. Seu PIN jamais transita em texto puro pela internet.</li>
              </ul>

              <h3 className="font-bold text-sm text-[#F5F5F5]">2. Armazenamento e Segurança</h3>
              <p>
                Seus dados são armazenados de forma isolada no banco de dados Firestore protegido por regras de segurança estritas (Attribute-Based Access Control) que garantem que apenas membros autorizados de um workspace acessem seus dados. Não utilizamos rastreadores invasivos nem vendemos dados a terceiros.
              </p>

              <h3 className="font-bold text-sm text-[#F5F5F5]">3. Seus Direitos (LGPD - Lei Geral de Proteção de Dados)</h3>
              <p>
                Em conformidade com a LGPD (Lei nº 13.709/2018), você possui o direito de:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Acessar e consultar todos os seus dados a qualquer momento;</li>
                <li>Exportar seus dados em formato portátil (JSON / CSV);</li>
                <li>Corrigir dados incompletos ou inexatos;</li>
                <li>Eliminar definitivamente seus dados e sua conta através da opção "Excluir minha conta e meus dados".</li>
              </ul>

              <h3 className="font-bold text-sm text-[#F5F5F5]">4. Contato do Encarregado de Dados (DPO)</h3>
              <p>
                Para dúvidas ou solicitações referentes à proteção de seus dados pessoais, entre em contato através do e-mail oficial de suporte do aplicativo.
              </p>
            </div>
          </>
        )}

        {/* Footer legal disclaimer required by Section 15 */}
        <div className="pt-6 border-t border-[#2B2B2B] text-[11px] text-[#A3A3A3]/80 italic">
          Aviso legal: Texto-base informativo e em conformidade com as diretrizes do aplicativo. Recomenda-se revisar com um profissional jurídico antes da publicação e operação comercial em larga escala.
        </div>
      </div>
    </div>
  );
};
