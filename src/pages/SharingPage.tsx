import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Shield,
  Eye,
  Trash2,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  FolderPlus,
  ArrowRight,
  Edit2,
  Save,
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const SharingPage: React.FC = () => {
  const { userProfile, switchActiveWorkspace } = useAuth();
  const {
    workspace,
    members,
    isOwner,
    createInvite,
    joinWorkspaceByInvite,
    updateMemberRole,
    removeMember,
    leaveWorkspace,
    createWorkspace,
    updateWorkspaceName,
  } = useWorkspace();

  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [inputCode, setInputCode] = useState<string>('');
  const [newWsName, setNewWsName] = useState<string>('');
  
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({});

  const [isEditingWs, setIsEditingWs] = useState<boolean>(false);
  const [editedWsName, setEditedWsName] = useState<string>(workspace?.name || '');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const workspaceList = (userProfile?.workspaceIds || [workspace?.id]).filter((wid): wid is string => Boolean(wid));

  useEffect(() => {
    let active = true;
    const fetchNames = async () => {
      const names: Record<string, string> = {};
      for (const wid of workspaceList) {
        if (wid === workspace?.id && workspace?.name) {
          names[wid] = workspace.name;
          continue;
        }
        try {
          const snap = await getDoc(doc(db, 'workspaces', wid));
          if (snap.exists() && snap.data().name) {
            names[wid] = snap.data().name;
          } else {
            names[wid] = (wid === workspace?.id && workspace?.name) ? workspace.name : 'Workspace';
          }
        } catch {
          names[wid] = (wid === workspace?.id && workspace?.name) ? workspace.name : 'Workspace';
        }
      }
      if (active) {
        setWorkspaceNames(names);
      }
    };
    fetchNames();
    return () => {
      active = false;
    };
  }, [workspaceList, workspace?.id, workspace?.name]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const code = await createInvite(inviteRole);
      setGeneratedCode(code);
      setCopied(false);
      setFeedback({ type: 'success', text: 'Código de convite gerado com validade de 7 dias!' });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao gerar código de convite.' });
    }
    setIsGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!inputCode.trim()) return;
    const res = await joinWorkspaceByInvite(inputCode.trim());
    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
      setInputCode('');
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      await createWorkspace(newWsName.trim());
      setFeedback({ type: 'success', text: `Workspace "${newWsName}" criado e ativado com sucesso!` });
      setNewWsName('');
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao criar novo workspace.' });
    }
  };

  const handleSaveWorkspaceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedWsName.trim()) return;
    try {
      await updateWorkspaceName(editedWsName.trim());
      setIsEditingWs(false);
      setFeedback({ type: 'success', text: 'Nome do workspace atualizado com sucesso!' });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao atualizar nome do workspace.' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-[var(--text-primary)]">
      <div>
        <h2 className="text-xl font-bold">Gestão de Workspaces & Família</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Organize finanças por áreas independentes (Pessoal, Trabalho, Projetos) e colabore em tempo real
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            feedback.type === 'success'
              ? 'bg-[#4ADE80]/15 border-[#4ADE80]/30 text-[#4ADE80]'
              : 'bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>
      )}

      {workspace && (
        <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D97757]/20 text-[#D97757] flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#D97757] uppercase tracking-wider">Workspace Ativo</span>
                {isEditingWs ? (
                  <form onSubmit={handleSaveWorkspaceName} className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editedWsName}
                      onChange={e => setEditedWsName(e.target.value)}
                      className="px-3 py-1 bg-[var(--bg-elevated)] border border-[#D97757] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none"
                      autoFocus
                    />
                    <button type="submit" className="p-1.5 bg-[#4ADE80] text-[#0A0A0A] rounded-xl">
                      <Save className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setIsEditingWs(false)} className="p-1.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-xl">
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{workspace.name}</h3>
                    {isOwner && (
                      <button
                        onClick={() => {
                          setEditedWsName(workspace.name);
                          setIsEditingWs(true);
                        }}
                        className="p-1 text-[var(--text-secondary)] hover:text-[#D97757]"
                        title="Renomear Workspace"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-5 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
          <Briefcase className="w-5 h-5 text-[#D97757]" />
          <h3 className="font-bold text-sm">Alternar ou Criar Áreas Independentes</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2.5">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Suas Sessões Disponíveis</span>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {workspaceList.map(wid => {
                const isActive = wid === workspace?.id;
                const displayName =
                  (wid === workspace?.id && workspace?.name)
                    ? workspace.name
                    : workspaceNames[wid] || (wid === workspace?.id ? workspace?.name : null) || 'Workspace';
                return (
                  <div
                    key={wid}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs transition-colors ${
                      isActive
                        ? 'bg-[#D97757]/15 border-[#D97757]/40 font-bold'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Briefcase className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#D97757]' : 'text-[var(--text-secondary)]'}`} />
                      <span className="truncate">{displayName}</span>
                    </div>

                    {isActive ? (
                      <span className="px-2.5 py-1 bg-[#D97757] text-[#0A0A0A] rounded-lg text-[10px] font-extrabold uppercase">
                        Ativo
                      </span>
                    ) : (
                      <button
                        onClick={() => switchActiveWorkspace(wid)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[#D97757] hover:text-[#0A0A0A] border border-[var(--border-color)] rounded-xl transition-all"
                      >
                        <span>Alternar</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl space-y-3 flex flex-col justify-between">
            <form onSubmit={handleCreateWorkspaceSubmit} className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D97757]">
                <FolderPlus className="w-4 h-4" />
                <span>Nova Sessão / Projeto</span>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Nome (ex: Trabalho, Reforma)</label>
                <input
                  type="text"
                  placeholder="Nome da área..."
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Criar e Ativar Área
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#D97757]" />
            <h3 className="font-bold text-sm">Convidar Membro para "{workspace?.name}"</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Gere um código seguro de acesso em tempo real. Quem entrar terá exatamente as mesmas informações atualizadas instantaneamente.
          </p>

          {isOwner ? (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Permissão</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole('editor')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 ${
                      inviteRole === 'editor'
                        ? 'bg-[#D97757] text-[#0A0A0A] border-[#D97757]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Editor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole('viewer')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 ${
                      inviteRole === 'viewer'
                        ? 'bg-[#D97757] text-[#0A0A0A] border-[#D97757]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visualizador</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-2.5 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                {isGenerating ? 'Gerando...' : 'Gerar Código de Convite Funcional'}
              </button>

              {generatedCode && (
                <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl space-y-2">
                  <span className="text-[11px] text-[var(--text-secondary)]">Código gerado (envie para seu amigo ou familiar):</span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-bold text-[#4ADE80] break-all">{generatedCode}</code>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--border-color)] text-[var(--text-primary)] rounded-lg shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-[#4ADE80]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl text-xs text-[var(--text-secondary)]">
              Apenas o proprietário deste workspace pode gerar códigos de convite.
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#4ADE80]" />
            <h3 className="font-bold text-sm">Entrar em um Workspace por Código</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Insira o código de convite recebido para acessar a conta compartilhada e sincronizar em tempo real:
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Código de Convite</label>
              <input
                type="text"
                placeholder="Cole o código aqui..."
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:border-[#4ADE80]"
              />
            </div>

            <button
              onClick={handleJoin}
              className="w-full py-2.5 bg-[#4ADE80] hover:bg-[#22C55E] text-[#0A0A0A] font-bold text-xs rounded-xl transition-all shadow-md"
            >
              Aceitar Convite e Sincronizar
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <div>
            <h3 className="font-bold text-sm">Membros com Acesso em Tempo Real ({members.length})</h3>
          </div>

          {!isOwner && (
            <button
              onClick={() => {
                if (confirm('Deseja realmente sair deste workspace?')) leaveWorkspace();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30 rounded-xl text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair deste Workspace</span>
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {members.map(m => (
            <div
              key={m.uid}
              className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#D97757]/20 text-[#D97757] font-bold flex items-center justify-center">
                  {(m.name?.[0] || 'M').toUpperCase()}
                </div>
                <div>
                  <h5 className="font-bold text-[var(--text-primary)]">{m.name}</h5>
                  <p className="text-[11px] text-[var(--text-secondary)]">{m.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isOwner && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={async e => {
                      const nextRole = e.target.value as 'editor' | 'viewer';
                      await updateMemberRole(m.uid, nextRole);
                      setFeedback({
                        type: 'success',
                        text: `Permissão de ${m.name} alterada para ${nextRole === 'editor' ? 'Editor' : 'Visualizador'}.`,
                      });
                    }}
                    className="px-2.5 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-[#4ADE80] focus:outline-none focus:border-[#D97757]"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                ) : (
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      m.role === 'owner'
                        ? 'bg-[#D97757]/20 text-[#D97757]'
                        : 'bg-[#4ADE80]/20 text-[#4ADE80]'
                    }`}
                  >
                    {m.role === 'owner' ? 'Proprietário' : m.role === 'editor' ? 'Editor' : 'Visualizador'}
                  </span>
                )}

                {isOwner && m.role !== 'owner' && (
                  <button
                    onClick={() => {
                      if (confirm(`Remover ${m.name}?`)) removeMember(m.uid);
                    }}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[#F87171]"
                    title="Remover Membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};