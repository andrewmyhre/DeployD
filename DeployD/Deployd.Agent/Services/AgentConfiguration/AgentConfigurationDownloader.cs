using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Deployd.Core;
using Deployd.Core.AgentConfiguration;
using Deployd.Core.Queries;
using NuGet;
using log4net;

namespace Deployd.Agent.Services.AgentConfiguration
{
    public class AgentConfigurationDownloader : IAgentConfigurationDownloader
    {
        public const string DEPLOYD_CONFIGURATION_PACKAGE_NAME = "Deployd.Configuration";
        private static readonly ILog Logger = LogManager.GetLogger(typeof (AgentConfigurationDownloader));
        private readonly IAgentConfigurationManager _agentConfigurationManager;
        private readonly IRetrievePackageQuery _packageQuery;
        private readonly IAgentSettingsManager _agentSettingsManager;

        public AgentConfigurationDownloader(IAgentConfigurationManager agentConfigurationManager,
                                            IRetrievePackageQuery packageQuery,
            IAgentSettingsManager agentSettingsManager)
        {
            _agentConfigurationManager = agentConfigurationManager;
            _packageQuery = packageQuery;
            _agentSettingsManager = agentSettingsManager;
        }

        public void DownloadAgentConfiguration()
        {
            Logger.Debug("downloading " + DEPLOYD_CONFIGURATION_PACKAGE_NAME);
            var configPackage = _packageQuery.GetLatestPackage(DEPLOYD_CONFIGURATION_PACKAGE_NAME);

            if (configPackage == null)
            {
                Logger.Error("configuration package is null");
                throw new AgentConfigurationPackageNotFoundException(DEPLOYD_CONFIGURATION_PACKAGE_NAME);
            }
            Logger.Debug("package downloaded");
            try
            {
                var files = configPackage.GetFiles();
                var agentConfigurationFile = ExtractAgentConfigurationFile(ConfigurationFiles.AGENT_CONFIGURATION_FILE,
                                                                           files);
                Logger.Debug("extracted");
                var agentConfigurationFileStream = agentConfigurationFile.GetStream();

                byte[] configBytes;
                using (var memoryStream = new MemoryStream())
                {
                    agentConfigurationFileStream.CopyTo(memoryStream);
                    configBytes = memoryStream.ToArray();
                    memoryStream.Close();
                }
                Logger.Debug("save");
                _agentConfigurationManager.SaveToDisk(configBytes);
                _agentSettingsManager.UnloadSettings();
                Logger.Debug("saved configuration package");
            } catch (Exception ex)
            {
                Logger.Error("failed", ex);
            }
        }

        private static IPackageFile ExtractAgentConfigurationFile(string targetFile, IEnumerable<IPackageFile> files)
        {
            Logger.Debug("extracting ");
            var agentConfigFileList = files.Where(x => x.Path == targetFile).ToList();

            if (agentConfigFileList.Count == 0)
            {
                throw new AgentConfigurationNotFoundException(DEPLOYD_CONFIGURATION_PACKAGE_NAME, targetFile);
            }

            return agentConfigFileList[0];
        }
    }
}