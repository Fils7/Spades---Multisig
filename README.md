  ___________________  _____  ________  ___________ _________
 /   _____/\______   \/  _  \ \______ \ \_   _____//   _____/
 \_____  \  |     ___/  /_\  \ |    |  \ |    __)_ \_____  \ 
 /        \ |    |  /    |    \|    `   \|        \/        \
/_______  / |____|  \____|__  /_______  /_______  /_______  /
        \/                  \/        \/        \/        \/ 

This paper introduces **Spades**: an open source multisig wallet.

Like a regular crypto wallet, **Spades** is a smart contract, that uses multisignature as its core feature. Users that deploy this contract can chose how many owners and signatures will be required.

This provides an added layer of security, as it ensures that no single person can unilaterally access or transfer the funds.

In addition to its multisignature functionality, this particular wallet also will have several features like, a time frame mechanism that allows owners to set a specific time for the transaction to be executed only if not revoked by any owner. 

When activated, the time frame feature essentially put an hold on any pending transactions (need to be equal or passed required signatures) until they are manually released by this time frame. This helps to prevent accidental or unauthorized transfers and gives users greater control over their funds.

Overall, this combination of multisignature security and transaction locking makes this wallet an ideal choice for those looking for enhanced protection and flexibility when managing their crypto holdings.
