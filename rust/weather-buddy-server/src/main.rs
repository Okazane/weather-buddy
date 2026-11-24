use anyhow::Context;
use clap::Parser;
use std::{net::SocketAddr, path::PathBuf};
use tracing_subscriber::EnvFilter;
use weather_buddy_server::{build_router, ServerConfig, DEFAULT_PORT, SERVER_VERSION};

#[derive(Debug, Parser)]
#[command(
    name = "weather-buddy-server",
    version = SERVER_VERSION,
    about = "WeatherBuddy High-Performance Axum Backend API & Static Dashboard Server"
)]
struct CliArgs {
    #[arg(long, env = "HOST", default_value = "127.0.0.1")]
    host: String,

    #[arg(long, env = "PORT", default_value_t = DEFAULT_PORT)]
    port: u16,

    #[arg(long, env = "WEATHER_BUDDY_ROOT")]
    project_root: Option<PathBuf>,
}

fn resolve_default_project_root() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if cwd.join("package.json").exists() {
        return cwd;
    }
    if let Some(parent) = cwd.parent() {
        if parent.join("package.json").exists() {
            return parent.to_path_buf();
        }
        if let Some(grandparent) = parent.parent() {
            if grandparent.join("package.json").exists() {
                return grandparent.to_path_buf();
            }
        }
    }
    cwd
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let args = CliArgs::parse();
    let project_root = args
        .project_root
        .unwrap_or_else(resolve_default_project_root);

    let config = ServerConfig {
        host: args.host.clone(),
        port: args.port,
        project_root,
    };

    let bind_addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .with_context(|| format!("Failed to bind TCP listener on {bind_addr}"))?;
    let local_addr = listener.local_addr()?;

    let router = build_router(config).await?;
    println!(
        "[WeatherBuddy Rust Backend v{SERVER_VERSION}] Listening on http://{local_addr} (15-min DashMap cache + security hardening active)"
    );

    let service = router.into_make_service_with_connect_info::<SocketAddr>();
    axum::serve(listener, service)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
            println!("[WeatherBuddy Rust Backend] Shutting down gracefully...");
        })
        .await?;

    Ok(())
}
