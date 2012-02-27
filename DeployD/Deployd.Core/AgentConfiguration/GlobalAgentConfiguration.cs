using System.Collections.Generic;

namespace Deployd.Core.AgentConfiguration
{
    public class GlobalAgentConfiguration
    {
        public List<DeploymentEnvironment> Environments { get; set; }

        public GlobalAgentConfiguration()
        {
            Environments = new List<DeploymentEnvironment>();
        }
    }
}