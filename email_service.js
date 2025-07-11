class MockProviderA{
    constructor(){
        this.name='providerA';
    }

    async send(email){
        console.log(`[${this.name}] sending email to ${email.to}`);

        if(Math.random()<0.7)return true;
        throw new Error(`${this.name} failed`);
    }
}

class MockProviderB{
    constructor(){
        this.name='providerB';
    }

    async send(email){
        console.log(`[${this.name}] sending email to ${email.to}`);

        if(Math.random()<0.7)return true;
        throw new Error(`${this.name} failed`);
    }
}

class EmailService{
    constructor(providers){
        this.providers=providers;
        this.sentEmails=new Set();
        this.statusMap=new Map();
        this.rateLimit={max:5,windowMs:10000,timestamps:[]};
    }

    isRateLimited(){
        const now=Date.now();
        this.rateLimit.timestamps=this.rateLimit.timestamps.filter(ts => now-ts <this.rateLimit.windowMs);
        
        if(this.rateLimit.timestamps.length >=this.rateLimit.max){
            return true;
        }

        this.rateLimit.timestamps.push(now);
        return false;
    }

    async sendEmail(email){
        if(this.sentEmails.has(email.id)){
            console.log(`[Idempotency] Email ${email.id} already sent.`);
            return ;
        }

        if(this.isRateLimited()){
            console.log(`[RateLimiter] Too many emails. Try again later.`);
            this.statusMap.set(email.id,'Rate limited');
            return;
        }

        for(const provider of this.providers){
            let success=false;

            for(let attempt=1;attempt<=3;attempt++){
                try{
                    await provider.send(email);
                    success=true;
                    break;
                }catch(err){
                    console.log(`[Retry ${attempt}] ${provider.name} failed. Retrying...`);
                    await new Promise(res=>setTimeout(res,500*attempt));
                }
            }

            if(success){
                console.log(`[Success] Email sent via ${provider.name}`);
                this.sentEmails.add(email.id);
                this.statusMap.set(email.id,`Sent via ${provider.name}`);
                return;
            }else{
                console.log(`[Fallback] ${provider.name} failed. Trying next provider.`);
            }
        }

        console.log(`[Failure] All providers failed for email ${email.id}`);
        this.statusMap.set(email.is, 'Failed');

    }

    getStatus(emailId){
        return this.statusMap.get(emailId);
    }
}





(async ()=>{
    const providers=[new MockProviderA(),new MockProviderB()];
    const emailService=new EmailService(providers);

    const email={
        id:'email-001',
        to:'user@example.com',
        subject:'testing',
        body:'this is a test email.'
    };

    await emailService.sendEmail(email);
    console.log('status:', emailService.getStatus(email.id));
})();