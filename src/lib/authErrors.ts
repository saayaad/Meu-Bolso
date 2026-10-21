/**
 * Translation of Firebase Auth errors to Brazilian Portuguese.
 */
export function translateAuthError(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado em outra conta.';
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido.';
    case 'auth/user-disabled':
      return 'Esta conta de usuário foi desativada.';
    case 'auth/user-not-found':
      return 'Nenhum usuário encontrado com este e-mail.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha com no mínimo 8 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Por favor, aguarde alguns minutos e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação do Google foi fechada antes da conclusão.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela pop-up do Google. Por favor, permita pop-ups para este site.';
    case 'auth/network-request-failed':
      return 'Falha na conexão de rede. Verifique sua conexão com a internet.';
    case 'auth/requires-recent-login':
      return 'Esta operação requer autenticação recente. Por favor, faça login novamente.';
    case 'auth/expired-action-code':
      return 'O link de verificação ou recuperação expirou.';
    case 'auth/invalid-action-code':
      return 'O código da ação é inválido ou já foi utilizado.';
    default:
      return 'Ocorreu um erro na autenticação. Por favor, tente novamente.';
  }
}
