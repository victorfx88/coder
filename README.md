<!-- markdownlint-disable MD041 -->
<div align="center">
  <a href="https://coder.com#gh-light-mode-only">
    <img src="./docs/images/logo-black.png" alt="Coder Logo Light" style="width: 128px">
  </a>
  <a href="https://coder.com#gh-dark-mode-only">
    <img src="./docs/images/logo-white.png" alt="Coder Logo Dark" style="width: 128px">
  </a>

  <h1>
  ⚰️🖤 Abyssal Cloud Development Environments 🖤⚰️
  </h1>

  <a href="https://coder.com#gh-light-mode-only">
    <img src="./docs/images/banner-black.png" alt="Coder Banner Light" style="width: 650px">
  </a>
  <a href="https://coder.com#gh-dark-mode-only">
    <img src="./docs/images/banner-white.png" alt="Coder Banner Dark" style="width: 650px">
  </a>

  <br>
  <br>

[🕸️ Quickstart 🕸️](#quickstart) | [📜 Grimoire 📜](https://coder.com/docs) | [🔮 Why Coder 🔮](https://coder.com/why) | [⚔️ Premium ⚔️](https://coder.com/pricing#compare-plans)

[![discord](https://img.shields.io/discord/747933592273027093?label=discord)](https://discord.gg/coder)
[![release](https://img.shields.io/github/v/release/coder/coder)](https://github.com/coder/coder/releases/latest)
[![godoc](https://pkg.go.dev/badge/github.com/coder/coder.svg)](https://pkg.go.dev/github.com/coder/coder)
[![Go Report Card](https://goreportcard.com/badge/github.com/coder/coder/v2)](https://goreportcard.com/report/github.com/coder/coder/v2)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9511/badge)](https://www.bestpractices.dev/projects/9511)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/coder/coder/badge)](https://scorecard.dev/viewer/?uri=github.com%2Fcoder%2Fcoder)
[![license](https://img.shields.io/github/license/coder/coder)](./LICENSE)

</div>

[Coder](https://coder.com) ⛧ summons dark development environments from the depths of your public or private cloud infrastructure. Cloud development environments are defined with Terraform, connected through a secure high-speed Wireguard® tunnel, and automatically vanish into the void when not used to save on costs (for the darkness is ever economical). Coder gives engineering teams the power to harness the shadows of the cloud for workloads most beneficial to them. ⛧

- 🦇 Define cloud development environments in Terraform
  - 💀 EC2 VMs, Kubernetes Pods, Docker Containers, etc.
- 🌑 Automatically banish idle resources to save on costs (the void consumes all)
- ⚰️ Onboard developers in seconds instead of days (time is but an illusion)

<p align="center">
  <img src="./docs/images/hero-image.png" alt="Coder Hero Image">
</p>

## 🕸️ Quickstart 🕸️

The darkest path to try Coder is to install it on your local machine and experiment with summoning cloud development environments using Docker (works on Linux, macOS, and Windows). The ritual is simple.

```shell
# First, install Coder (the darkness awaits)
curl -L https://coder.com/install.sh | sh

# Start the Coder server (caches data in ~/.cache/coder like secrets in a crypt)
coder server

# Navigate to http://localhost:3000 to create your initial user,
# create a Docker template and provision a workspace (the void opens)
```

## 🔪 Install 🔪

The easiest way to install Coder is to use our
[install script](https://github.com/coder/coder/blob/main/install.sh) for Linux
and macOS. For Windows, use the latest `..._installer.exe` file from GitHub
Releases. The darkness spreads across all platforms.

```shell
curl -L https://coder.com/install.sh | sh
```

You can run the install script with `--dry-run` to see the commands that will be used to install without executing them. Run the install script with `--help` for additional flags. Knowledge is power.

> See [install](https://coder.com/docs/install) for additional methods.

Once installed, you can start a production deployment with a single command (the ritual is complete):

```shell
# Automatically sets up an external access URL on *.try.coder.app (the portal opens)
coder server

# Requires a PostgreSQL instance (version 13 or higher) and external access URL
coder server --postgres-url <url> --access-url <url>
```

Use `coder --help` to get a list of flags and environment variables. Use our [install guides](https://coder.com/docs/install) for a complete walkthrough. The path to darkness is well-documented.

## 📜 Grimoire 📜

Browse our grimoire [here](https://coder.com/docs) or visit a specific section below (knowledge is power):

- [**🕸️ Templates 🕸️**](https://coder.com/docs/templates): Templates are written in Terraform and describe the infrastructure for workspaces
- [**⚰️ Workspaces ⚰️**](https://coder.com/docs/workspaces): Workspaces contain the IDEs, dependencies, and configuration information needed for software development
- [**🖥️ IDEs 🖥️**](https://coder.com/docs/ides): Connect your existing editor to a workspace
- [**👑 Administration 👑**](https://coder.com/docs/admin): Learn how to operate Coder
- [**💎 Premium 💎**](https://coder.com/pricing#compare-plans): Learn about our paid features built for large covens

## 🦇 Support 🦇

Feel free to [open an issue](https://github.com/coder/coder/issues/new) if you have questions, encounter bugs, or desire a feature. We shall answer from the shadows. 

[Join our Discord](https://discord.gg/coder) to provide feedback on in-progress features and commune with others who have embraced the darkness of Coder.

## 🌒 Integrations 🌒

We are always working on new integrations (tools of the night). Please feel free to open an issue and ask for an integration. Contributions are welcome in any official or community repositories. The darkness grows stronger with each addition.

### ⚔️ Official ⚔️

- [**🖥️ VS Code Extension 🖥️**](https://marketplace.visualstudio.com/items?itemName=coder.coder-remote): Open any Coder workspace in VS Code with a single incantation
- [**🧙 JetBrains Gateway Extension 🧙**](https://plugins.jetbrains.com/plugin/19620-coder): Open any Coder workspace in JetBrains Gateway with a single ritual
- [**🐋 Dev Container Builder 🐋**](https://github.com/coder/envbuilder): Build development environments using `devcontainer.json` on Docker, Kubernetes, and OpenShift
- [**📦 Module Registry 📦**](https://registry.coder.com): Extend development environments with common dark arts
- [**📊 Kubernetes Log Stream 📊**](https://github.com/coder/coder-logstream-kube): Stream Kubernetes Pod events to the Coder startup logs
- [**🧩 Self-Hosted VS Code Extension Marketplace 🧩**](https://github.com/coder/code-marketplace): A private extension marketplace that works in restricted or airgapped networks integrating with [code-server](https://github.com/coder/code-server).
- [**⚙️ Setup Coder ⚙️**](https://github.com/marketplace/actions/setup-coder): An action to setup coder CLI in GitHub workflows.

### 🌑 Community 🌑

- [**☁️ Provision Coder with Terraform ☁️**](https://github.com/ElliotG/coder-oss-tf): Provision Coder on Google GKE, Azure AKS, AWS EKS, DigitalOcean DOKS, IBMCloud K8s, OVHCloud K8s, and Scaleway K8s Kapsule with Terraform
- [**🔄 Coder Template GitHub Action 🔄**](https://github.com/marketplace/actions/update-coder-template): A GitHub Action that updates Coder templates

## 🖤 Contributing 🖤

We welcome new acolytes to the Coder codebase. If you are new to our dark arts, we have
[a guide on how to get started](https://coder.com/docs/CONTRIBUTING). We'd love to see your
contributions to our grand design.

## 💀 Hiring 💀

Apply [here](https://jobs.ashbyhq.com/coder?utm_source=github&utm_medium=readme&utm_campaign=unknown) if you're interested in joining our coven of darkness.
