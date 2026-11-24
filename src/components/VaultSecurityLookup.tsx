import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  RefreshCw,
  FileCheck2,
  Hash,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Upload,
  Smartphone,
  Cpu,
  FileArchive,
  Download,
  Globe,
} from 'lucide-react';
import {
  GithubReleaseAssetItem,
  OfficialExternalSourceEntry,
  OfficialGithubRepoEntry,
  SubscriberVaultPackage,
} from '../types/automotive';
import { apiFetch } from '../utils/apiBridge';

interface VaultSecurityLookupProps {
  vaultItems: SubscriberVaultPackage[];
  isAdmin: boolean;
  onSelectVerifiedFileForUpload?: (file: File, sha256: string, releaseTag?: string) => void;
  onVaultItemImported?: (item: SubscriberVaultPackage, repoName: string) => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

async function computeFileSha256Hex(file: File): Promise<{
  sha256: string;
  hasPkSignature: boolean;
}> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const hasPkSignature =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06));

  const digest = await window.crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(digest));
  const sha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { sha256, hasPkSignature };
}

export const VaultSecurityLookup: React.FC<VaultSecurityLookupProps> = ({
  vaultItems,
  isAdmin,
  onSelectVerifiedFileForUpload,
  onVaultItemImported,
}) => {
  if (!isAdmin) {
    return null;
  }

  // Official GitHub repositories state
  const [repos, setRepos] = useState<OfficialGithubRepoEntry[]>([]);
  const [externalSources, setExternalSources] = useState<OfficialExternalSourceEntry[]>([]);
  const [reposLoading, setReposLoading] = useState<boolean>(true);
  const [repoQuery, setRepoQuery] = useState<string>('');
  const [repoCategory, setRepoCategory] = useState<string>('Tous');
  const [selectedRepo, setSelectedRepo] = useState<OfficialGithubRepoEntry | null>(null);
  const [assets, setAssets] = useState<GithubReleaseAssetItem[]>([]);
  const [assetsLoading, setAssetsLoading] = useState<boolean>(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [importingAssetId, setImportingAssetId] = useState<number | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Hash Verifier state
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [computingHash, setComputingHash] = useState<boolean>(false);
  const [computedSha256, setComputedSha256] = useState<string>('');
  const [hasPkSignature, setHasPkSignature] = useState<boolean | null>(null);
  const [expectedSha256, setExpectedSha256] = useState<string>('');
  const [expectedLabel, setExpectedLabel] = useState<string>('');
  const [serverVerifyResult, setServerVerifyResult] = useState<{
    vaultMatch: SubscriberVaultPackage | null;
    githubMatch: { repo: string; asset: GithubReleaseAssetItem } | null;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadSources = async () => {
      setReposLoading(true);
      try {
        const res = await apiFetch('/api/vault/github-sources');
        const data = await res.json();
        if (active && res.ok && data?.success) {
          if (Array.isArray(data.repos)) setRepos(data.repos);
          if (Array.isArray(data.externalSources)) setExternalSources(data.externalSources);
        }
      } catch {
        // Ignore initial load error gracefully
      } finally {
        if (active) setReposLoading(false);
      }
    };
    void loadSources();
    return () => {
      active = false;
    };
  }, []);

  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase();
    return repos.filter((r) => {
      const catOk = repoCategory === 'Tous' || r.category === repoCategory;
      const qOk =
        !q ||
        r.displayName.toLowerCase().includes(q) ||
        r.repo.toLowerCase().includes(q) ||
        r.descriptionFr.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [repos, repoCategory, repoQuery]);

  const handleLoadRepoReleases = async (repo: OfficialGithubRepoEntry) => {
    setSelectedRepo(repo);
    setAssets([]);
    setAssetsError(null);
    setAssetsLoading(true);
    try {
      const res = await apiFetch(`/api/vault/github-releases?repo=${encodeURIComponent(repo.repo)}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Impossible de récupérer les releases GitHub.');
      }
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (err: any) {
      setAssetsError(err?.message || 'Erreur lors de la lecture des releases GitHub.');
    } finally {
      setAssetsLoading(false);
    }
  };

  const handleAdminImportAsset = async (asset: GithubReleaseAssetItem) => {
    if (!isAdmin || !selectedRepo) return;

    setImportingAssetId(asset.id);
    setAssetsError(null);
    setImportFeedback(null);

    try {
      const res = await apiFetch('/api/admin/vault/import-github', {
        method: 'POST',
        timeoutMs: 180_000,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: selectedRepo.repo,
          assetId: asset.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.item) {
        throw new Error(data?.error || 'Impossible d’importer ce fichier depuis GitHub.');
      }
      setImportFeedback(
        `"${data.item.fileName}" importé et publié dans votre Coffre Payant (SHA-256 vérifié).`
      );
      onVaultItemImported?.(data.item, selectedRepo.repo);
    } catch (err: any) {
      setAssetsError(err?.message || 'Erreur réseau pendant l’import depuis GitHub.');
    } finally {
      setImportingAssetId(null);
    }
  };

  const runServerHashLookup = async (shaHex: string) => {
    const clean = shaHex.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(clean)) {
      setServerVerifyResult(null);
      return;
    }
    try {
      const res = await apiFetch('/api/vault/verify-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha256: clean }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setServerVerifyResult({
          vaultMatch: data.vaultMatch || null,
          githubMatch: data.githubMatch || null,
        });
      }
    } catch {
      // Non-fatal server lookup fallback
    }
  };

  const handleLocalFileVerify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalFile(file);
    setVerifyError(null);
    setComputedSha256('');
    setHasPkSignature(null);
    setServerVerifyResult(null);

    if (!window.crypto?.subtle) {
      setVerifyError('WebCrypto SHA-256 indisponible dans ce navigateur.');
      return;
    }

    setComputingHash(true);
    try {
      const { sha256, hasPkSignature: pkOk } = await computeFileSha256Hex(file);
      setComputedSha256(sha256);
      setHasPkSignature(pkOk);
      await runServerHashLookup(sha256);
    } catch {
      setVerifyError('Impossible de calculer l’empreinte SHA-256 du fichier.');
    } finally {
      setComputingHash(false);
    }
  };

  const handleUseAssetHash = (asset: GithubReleaseAssetItem) => {
    if (!asset.sha256) return;
    setExpectedSha256(asset.sha256);
    setExpectedLabel(`${selectedRepo?.repo || 'GitHub'} · ${asset.name} (${asset.releaseTag})`);
    if (computedSha256) {
      void runServerHashLookup(computedSha256);
    }
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1800);
  };

  const normalizedExpected = expectedSha256.trim().toLowerCase();
  const isExpectedValidFormat = /^[a-f0-9]{64}$/.test(normalizedExpected);
  const hashComparisonStatus: 'idle' | 'match' | 'mismatch' | 'invalid_expected' = useMemo(() => {
    if (!computedSha256) return 'idle';
    if (!normalizedExpected) return 'idle';
    if (!isExpectedValidFormat) return 'invalid_expected';
    return computedSha256.toLowerCase() === normalizedExpected ? 'match' : 'mismatch';
  }, [computedSha256, normalizedExpected, isExpectedValidFormat]);

  const localApkNeedsPkWarning = useMemo(() => {
    if (!localFile || hasPkSignature === null) return false;
    const lower = localFile.name.toLowerCase();
    return (lower.endsWith('.apk') || lower.endsWith('.zip')) && !hasPkSignature;
  }, [localFile, hasPkSignature]);

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/35 space-y-5 shadow-lg">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" />
              <span>Dépôts GitHub Officiels (Liste Blanche)</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
              <Hash className="w-3 h-3" />
              <span>Contrôle Intégrité SHA-256</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-white">
            Recherche Ressources Sécurisées (GitHub Officiel) &amp; Validation Hash
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Listez les versions officielles <code className="text-cyan-300">.apk</code> /{' '}
            <code className="text-cyan-300">.bin</code> publiées sur GitHub par les auteurs d’origine et vérifiez
            l’empreinte <strong>SHA-256</strong> de vos fichiers avant de les publier ou de les installer.
          </p>
        </div>
      </div>

      {/* Grid: Left = GitHub Official Search & Releases | Right = Local & Server SHA-256 Validator */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* LEFT: Official GitHub Repository Search */}
        <div className="xl:col-span-7 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                placeholder="Chercher SmartTube, AndrOBD, Fermata, GPS..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-400 outline-none"
              />
            </div>
            <select
              value={repoCategory}
              onChange={(e) => setRepoCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-cyan-400 outline-none"
            >
              <option value="Tous">Toutes catégories</option>
              <option value="Autoradio & Média">Autoradio &amp; Média</option>
              <option value="Android Auto">Android Auto</option>
              <option value="GPS Hors-Ligne">GPS Hors-Ligne</option>
              <option value="Diagnostic OBD2">Diagnostic OBD2</option>
              <option value="Utilitaires & GMS">Utilitaires &amp; GMS</option>
            </select>
          </div>

          {reposLoading ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Chargement des dépôts officiels...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.repo === repo.repo;
                return (
                  <div
                    key={repo.repo}
                    className={`p-3 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/35 border-cyan-500/70'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-extrabold text-white leading-snug">
                          {repo.displayName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] font-bold text-cyan-300 shrink-0">
                          {repo.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{repo.descriptionFr}</p>
                      <p className="text-[10px] font-mono text-emerald-300">{repo.license}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => void handleLoadRepoReleases(repo)}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-extrabold cursor-pointer flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" />
                        <span>Lister Releases</span>
                      </button>
                      <a
                        href={repo.officialHtmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-300 hover:text-cyan-300 flex items-center gap-1 font-mono"
                      >
                        <span>GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Repo Release Assets List */}
          {selectedRepo && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-cyan-300">
                  Releases officielles : {selectedRepo.repo}
                </span>
                <button
                  type="button"
                  onClick={() => void handleLoadRepoReleases(selectedRepo)}
                  disabled={assetsLoading}
                  className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${assetsLoading ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>Rafraîchir</span>
                </button>
              </div>

              {importFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{importFeedback}</span>
                </div>
              )}

              {assetsLoading ? (
                <p className="text-xs text-slate-400 flex items-center gap-2 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Interrogation sécurisée de api.github.com...</span>
                </p>
              ) : assetsError ? (
                <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
                  <span>{assetsError}</span>
                  <a
                    href={selectedRepo.officialHtmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-slate-900 text-cyan-300 font-bold shrink-0 flex items-center gap-1"
                  >
                    <span>Ouvrir GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : assets.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Aucun fichier .apk ou .bin trouvé dans les 4 dernières releases.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {assets.map((asset) => {
                    const inVault = vaultItems.some(
                      (v) =>
                        (Boolean(asset.sha256) && Boolean(v.sha256) && v.sha256!.toLowerCase() === asset.sha256!.toLowerCase()) ||
                        v.fileName.toLowerCase() === asset.name.toLowerCase()
                    );

                    return (
                      <div
                        key={asset.id}
                        className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {asset.extension === '.apk' ? (
                              <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                            ) : asset.extension === '.zip' ? (
                              <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <span className="font-mono font-bold text-white truncate">
                              {asset.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-mono">
                              {asset.releaseTag}
                            </span>
                            {inVault && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40 text-[10px] font-bold">
                                Déjà dans le Coffre
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatBytes(asset.sizeBytes)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          {asset.sha256 ? (
                            <div className="flex items-center gap-1.5 font-mono text-emerald-300 bg-slate-950 px-2 py-1 rounded border border-emerald-700/40 max-w-full">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                SHA-256 ({asset.sha256Source === 'github_digest' ? 'GitHub Officiel' : 'Release Notes'}) :{' '}
                                {asset.sha256.slice(0, 22)}...
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopySha(asset.sha256!)}
                                className="text-cyan-300 hover:text-cyan-200 cursor-pointer shrink-0"
                                title="Copier SHA-256"
                              >
                                {copiedSha === asset.sha256 ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">
                              SHA-256 non publié par l’auteur dans cette release (vérifiez localement après téléchargement)
                            </span>
                          )}

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {asset.sha256 && (
                              <button
                                type="button"
                                onClick={() => handleUseAssetHash(asset)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold cursor-pointer"
                              >
                                Vérifier ce Hash
                              </button>
                            )}
                            {isAdmin && !inVault && (
                              <button
                                type="button"
                                disabled={importingAssetId === asset.id}
                                onClick={() => void handleAdminImportAsset(asset)}
                                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold flex items-center gap-1 cursor-pointer"
                              >
                                {importingAssetId === asset.id ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Import...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3" />
                                    <span>Importer au Coffre (1 Clic)</span>
                                  </>
                                )}
                              </button>
                            )}
                            {asset.downloadUrl.startsWith('https://github.com/') && (
                              <a
                                href={asset.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                              >
                                <span>GitHub</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Local File Hash & Integrity Validator */}
        <div className="xl:col-span-5 p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3.5 h-fit">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Vérificateur d&apos;Intégrité APK / .BIN (SHA-256)</span>
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Contrôlez un fichier téléchargé (ex : <code className="text-cyan-300">AA-Bridge.apk</code>,{' '}
              <code className="text-cyan-300">SmartTube.apk</code> ou <code className="text-cyan-300">.bin</code>)
              avant de l’installer ou de le publier aux abonnés.
            </p>
          </div>

          {/* 1. Pick local file */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              1. Analyser un fichier local (.apk, .bin, .zip, .eep, .hex)
            </label>
            <label className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-dashed border-emerald-500/50 hover:border-emerald-400 text-xs text-slate-200 flex items-center justify-between gap-2 cursor-pointer">
              <span className="truncate font-mono">
                {localFile
                  ? `${localFile.name} (${formatBytes(localFile.size)})`
                  : 'Choisir un fichier sur votre appareil...'}
              </span>
              {computingHash ? (
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              ) : (
                <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <input
                type="file"
                accept=".apk,.bin,.zip,.eep,.hex"
                onChange={handleLocalFileVerify}
                className="hidden"
              />
            </label>
          </div>

          {/* 2. Expected SHA-256 */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[11px] font-semibold text-slate-300">
                2. Hash SHA-256 officiel attendu (optionnel)
              </label>
              {expectedLabel && (
                <span className="text-[10px] text-amber-300 truncate max-w-[180px]">{expectedLabel}</span>
              )}
            </div>
            <input
              type="text"
              value={expectedSha256}
              onChange={(e) => {
                setExpectedSha256(e.target.value);
                setExpectedLabel('');
              }}
              placeholder="Coller un SHA-256 (64 caractères hex) ou cliquer « Vérifier ce Hash »"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-mono text-cyan-300 focus:border-cyan-400 outline-none"
            />
          </div>

          {verifyError && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          {computedSha256 && (
            <div className="space-y-2.5 pt-1">
              {/* Computed SHA-256 */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold uppercase tracking-wide">Empreinte calculée localement</span>
                  <button
                    type="button"
                    onClick={() => handleCopySha(computedSha256)}
                    className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSha === computedSha256 ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copié</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] font-mono text-white break-all select-all">{computedSha256}</p>
              </div>

              {/* APK/ZIP Magic Byte Check */}
              {localApkNeedsPkWarning ? (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/60 text-[11px] text-rose-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Structure APK/ZIP invalide :</strong> ce fichier ne commence pas par l’en-tête binaire
                    ZIP (<code>PK</code>). Il est peut-être corrompu ou est une page HTML renommée.
                  </span>
                </div>
              ) : (
                hasPkSignature && (
                  <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-[11px] text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Signature binaire APK/ZIP valide (En-tête PK détecté).</span>
                  </div>
                )
              )}

              {/* Expected SHA-256 Comparison Result */}
              {hashComparisonStatus === 'match' && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-xs text-emerald-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-emerald-300">HASH CERTIFIÉ AUTHENTIQUE (MATCH 100%)</p>
                    <p className="text-[11px] mt-0.5">
                      Le fichier local correspond exactement à l’empreinte SHA-256 officielle attendue.
                    </p>
                  </div>
                </div>
              )}

              {hashComparisonStatus === 'mismatch' && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-rose-300">ALERTE : HASH DIFFÉRENT</p>
                    <p className="text-[11px] mt-0.5">
                      Ce fichier ne correspond pas au hash officiel. Ne l’installez pas s’il vient d’une source inconnue.
                    </p>
                  </div>
                </div>
              )}

              {hashComparisonStatus === 'invalid_expected' && (
                <p className="text-[11px] text-amber-300">
                  Format du hash attendu invalide : un SHA-256 contient exactement 64 caractères hexadécimaux.
                </p>
              )}

              {/* Server Coffre & GitHub Cross-Check Result */}
              {serverVerifyResult?.vaultMatch && (
                <div className="p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-500/50 text-[11px] text-cyan-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Reconnu dans le <strong>Coffre Payant AutoPro</strong> :{' '}
                    <strong>{serverVerifyResult.vaultMatch.title}</strong> ({serverVerifyResult.vaultMatch.version}).
                  </span>
                </div>
              )}

              {serverVerifyResult?.githubMatch && (
                <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-[11px] text-emerald-200 flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Authentifié depuis GitHub officiel :{' '}
                    <strong>{serverVerifyResult.githubMatch.repo}</strong> ·{' '}
                    <code>{serverVerifyResult.githubMatch.asset.name}</code> (
                    {serverVerifyResult.githubMatch.asset.releaseTag}).
                  </span>
                </div>
              )}

              {/* Admin 1-Click Send to Coffre Upload Form */}
              {isAdmin &&
                localFile &&
                !localApkNeedsPkWarning &&
                onSelectVerifiedFileForUpload && (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectVerifiedFileForUpload(
                        localFile,
                        computedSha256,
                        serverVerifyResult?.githubMatch?.asset.releaseTag
                      )
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Pré-remplir le Dépôt Coffre avec ce fichier vérifié</span>
                  </button>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Autres Sources Officielles (F-Droid, Aurora Store, APKMirror, XDA) */}
      {externalSources.length > 0 && (
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-cyan-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Autres Sources Officielles Tablette Android (F-Droid · Aurora Store · APKMirror · XDA)</span>
            </h3>
            <span className="text-[10px] text-slate-400">
              Pour GPS complet, Waze, Launchers voiture (AGAMA / CarWebGuru) &amp; AIDA64 sans compte Google
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {externalSources.map((src) => (
              <div
                key={src.id}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-white">{src.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-amber-300 shrink-0">
                      {src.platform}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{src.descriptionFr}</p>
                  <p className="text-[10px] font-mono text-cyan-300">
                    Recommandés : {src.recommendedApps.join(', ')}
                  </p>
                </div>

                {src.officialUrl.startsWith('https://') && (
                  <a
                    href={src.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>Ouvrir {src.platform}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
