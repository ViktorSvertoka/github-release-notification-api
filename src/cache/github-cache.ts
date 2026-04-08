export interface GitHubCache {
  getRepositoryExists(repository: string): Promise<boolean | null>;
  setRepositoryExists(repository: string, exists: boolean): Promise<void>;
  getLatestRelease(
    repository: string
  ): Promise<{ tagName: string; htmlUrl: string } | null | undefined>;
  setLatestRelease(
    repository: string,
    release: { tagName: string; htmlUrl: string } | null
  ): Promise<void>;
}
