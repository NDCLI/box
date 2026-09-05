const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

async function main() {
  const root = path.resolve(__dirname, '..');
  process.chdir(root);
  const testBuild = process.argv.includes('--test');
  const identityName = testBuild ? 'NDCLI.CVATBoxCounter.Test' : process.env.STORE_IDENTITY_NAME?.trim();
  const publisher = testBuild ? 'CN=NDCLI.Test' : process.env.STORE_PUBLISHER?.trim();
  const publisherDisplayName = testBuild ? 'NDCLI (Test)' : process.env.STORE_PUBLISHER_DISPLAY_NAME?.trim();
  if (!identityName || !publisher || !publisherDisplayName) {
    throw new Error('Set STORE_IDENTITY_NAME, STORE_PUBLISHER and STORE_PUBLISHER_DISPLAY_NAME from Partner Center. Use --test only for a package that cannot be submitted.');
  }
  if (!/^[A-Za-z0-9.-]{3,50}$/.test(identityName) || !publisher.startsWith('CN=')) {
    throw new Error('Invalid Store identity. Copy the exact Identity Name and Publisher (CN=...) from Partner Center.');
  }

  // Desktop Store distribution uses the no-analytics privacy policy.
  process.env.VITE_POSTHOG_KEY = '';
  require('./prepare-default-tokens.cjs');
  require('./clean-release.cjs');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'prepare-store-assets.ps1')], { stdio: 'inherit', windowsHide: true });
  const cachedKit = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'win-codesign@1.1.0', 'windows-kits-bundle-10_0_26100_0-1pell', 'x64');
  const localKit = path.join(process.env.TEMP || root, 'cvat-store-windows-kit');
  if (fs.existsSync(cachedKit)) {
    fs.rmSync(localKit, { recursive: true, force: true });
    fs.cpSync(cachedKit, localKit, { recursive: true });
    fs.rmSync(path.join(localKit, 'makeappx.exe.manifest'), { force: true });
    fs.cpSync(path.join(root, 'desktop', 'generated', 'store-assets', 'appx'), localKit, { recursive: true });
    process.env.ELECTRON_BUILDER_WINDOWS_KITS_PATH = localKit;
  }
  const { build: buildRenderer } = await import('vite');
  await buildRenderer({ base: './', build: { outDir: 'dist-desktop' } });
  const { build, Platform, Arch } = require('electron-builder');
  await build({
    targets: Platform.WINDOWS.createTarget('appx', Arch.x64),
    publish: 'never',
    config: {
      extends: path.join(root, 'electron-builder.yml'),
      toolsets: { winCodeSign: '0.0.0' },
      directories: { output: 'release/store', buildResources: 'desktop/generated/store-assets' },
      appxManifestCreated: manifestPath => {
        const manifest = fs.readFileSync(manifestPath, 'utf8');
        fs.writeFileSync(manifestPath, manifest.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, '&amp;'));
      },
      appx: {
        identityName, publisher, publisherDisplayName,
        languages: ['vi-VN'],
        minVersion: '10.0.17763.0',
        maxVersionTested: '10.0.26100.0',
        backgroundColor: '#070a12',
        artifactName: testBuild
          ? 'CVAT-Box-Counter-TEST-DO-NOT-SUBMIT-${version}-${arch}.${ext}'
          : 'CVAT-Box-Counter-Store-${version}-${arch}.${ext}',
      },
    },
  });
  if (!fs.readdirSync(path.join(root, 'release', 'store')).some(name => name.endsWith('.appx'))) {
    throw new Error('Packaging did not produce an AppX file. Check the Windows SDK tool output.');
  }
  console.log(testBuild ? 'Test package only: rebuild with Partner Center identity before submission.' : 'Store package created. Complete certification checks before submitting.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
